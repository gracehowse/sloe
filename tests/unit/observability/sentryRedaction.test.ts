/**
 * Unit tests for the shared Sentry redaction helpers used by web
 * (client / server / edge) and mobile. The helpers are the single
 * defence layer between captured errors and the upstream Sentry
 * transport — every divergence from the intended privacy posture
 * lands here as a failing test.
 *
 * Implements coverage for Blocker 4 of the 2026-05-14 production-
 * readiness audit (`docs/decisions/2026-05-14-sentry-pre-consent-capture.md`).
 */

import { describe, expect, it } from "vitest";
import { redactPII, stripToCore } from "../../../src/lib/observability/sentryRedaction";

describe("redactPII", () => {
  it("strips the entire user object (id, email, ip)", () => {
    const event = {
      event_id: "abc",
      user: { id: "u_1", email: "grace@example.com", ip_address: "1.2.3.4" },
    };
    const out = redactPII(event);
    expect(out.user).toBeUndefined();
    expect(out.event_id).toBe("abc");
  });

  it("strips request.cookies and request.headers.authorization", () => {
    const event = {
      request: {
        url: "https://suppr.club/today",
        cookies: { session: "abc" },
        headers: {
          "user-agent": "Mozilla/5.0",
          authorization: "Bearer xyz",
          cookie: "session=abc",
          "x-api-key": "k_live_xyz",
        },
      },
    };
    const out = redactPII(event);
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toEqual({ "user-agent": "Mozilla/5.0" });
    expect(out.request?.url).toBe("https://suppr.club/today");
  });

  it("strips any nested key matching token/secret/email/password patterns", () => {
    const event = {
      extra: {
        request_body: {
          username: "grace",
          password: "hunter2",
          api_token: "tok_abc",
          stripe_secret: "sk_live_abc",
          deep: { nested_email: "g@x.com", keep_me: "ok" },
        },
      },
    };
    const out = redactPII(event);
    const body = (out.extra?.request_body as Record<string, unknown>) ?? {};
    expect(body.username).toBe("grace");
    expect(body.password).toBeUndefined();
    expect(body.api_token).toBeUndefined();
    expect(body.stripe_secret).toBeUndefined();
    expect((body.deep as Record<string, unknown>).nested_email).toBeUndefined();
    expect((body.deep as Record<string, unknown>).keep_me).toBe("ok");
  });

  it("drops breadcrumbs that mention an email address", () => {
    const event = {
      breadcrumbs: [
        { category: "navigation", message: "/today" },
        { category: "console.error", message: "user grace@example.com hit 500" },
        { category: "ui.click", message: "Logged meal" },
      ],
    };
    const out = redactPII(event);
    expect(out.breadcrumbs).toEqual([
      { category: "navigation", message: "/today" },
      { category: "ui.click", message: "Logged meal" },
    ]);
  });

  it("drops breadcrumbs whose data contains a JWT-shaped token", () => {
    const event = {
      breadcrumbs: [
        {
          category: "xhr",
          message: "POST /api/log",
          data: {
            authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR.eyJzdWIiOiIxMjM0NQ.SflKxwRJSMeKKF",
          },
        },
        { category: "navigation", message: "/today" },
      ],
    };
    const out = redactPII(event);
    expect(out.breadcrumbs).toEqual([{ category: "navigation", message: "/today" }]);
  });

  it("strips PII-shaped tag keys", () => {
    const event = {
      tags: {
        route: "/today",
        user_email: "g@x.com",
        feature: "barcode",
      },
    };
    const out = redactPII(event);
    expect(out.tags).toEqual({ route: "/today", feature: "barcode" });
  });

  it("does not mutate the input event", () => {
    const event = { user: { id: "u_1" }, request: { cookies: { a: "b" } } };
    const snapshot = JSON.parse(JSON.stringify(event));
    redactPII(event);
    expect(event).toEqual(snapshot);
  });
});

describe("stripToCore", () => {
  it("keeps event_id, level, release, environment, fingerprint", () => {
    const out = stripToCore({
      event_id: "abc",
      level: "error",
      release: "suppr@1.2.3",
      environment: "production",
      fingerprint: ["NutritionApiError"],
      user: { id: "u_1" },
      request: { url: "x", cookies: { a: "b" } },
    });
    expect(out.event_id).toBe("abc");
    expect(out.level).toBe("error");
    expect(out.release).toBe("suppr@1.2.3");
    expect(out.environment).toBe("production");
    expect(out.fingerprint).toEqual(["NutritionApiError"]);
    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
  });

  it("keeps exception.value but truncates to 200 chars", () => {
    const long = "x".repeat(500);
    const out = stripToCore({
      exception: {
        values: [{ type: "TypeError", value: long }],
      },
    });
    const ex = out.exception?.values?.[0];
    expect(ex?.type).toBe("TypeError");
    expect(ex?.value?.length).toBe(201); // 200 chars + ellipsis
    expect(ex?.value?.endsWith("…")).toBe(true);
  });

  it("drops stacktrace.frames[*].vars but keeps the frames themselves", () => {
    const out = stripToCore({
      exception: {
        values: [
          {
            type: "TypeError",
            value: "boom",
            stacktrace: {
              frames: [
                {
                  filename: "app/today.tsx",
                  lineno: 42,
                  vars: { token: "secret_xyz", user: { email: "g@x.com" } },
                },
              ],
            },
          },
        ],
      },
    });
    const frame = out.exception?.values?.[0]?.stacktrace?.frames?.[0];
    expect(frame?.filename).toBe("app/today.tsx");
    expect(frame?.lineno).toBe(42);
    expect(frame?.vars).toBeUndefined();
  });

  it("retains allow-listed tags (route, feature, consent_state)", () => {
    const out = stripToCore({
      tags: {
        route: "/today",
        feature: "barcode",
        consent_state: "pre_consent",
        user_id: "u_1",
        api_token: "tok",
      },
    });
    expect(out.tags).toEqual({
      route: "/today",
      feature: "barcode",
      consent_state: "pre_consent",
    });
  });

  it("filters breadcrumbs to message-only nav + console.error categories", () => {
    const out = stripToCore({
      breadcrumbs: [
        { category: "navigation", message: "/today" },
        { category: "navigation", message: "/profile", data: { url: "secret" } },
        { category: "console.error", message: "boom" },
        { category: "ui.click", message: "tap" },
        { category: "xhr", message: "POST /api/log" },
      ],
    });
    expect(out.breadcrumbs).toEqual([
      { category: "navigation", message: "/today" },
      { category: "navigation", message: "/profile" },
      { category: "console.error", message: "boom" },
    ]);
  });

  it("drops PII-bearing breadcrumbs even in allow-listed categories", () => {
    const out = stripToCore({
      breadcrumbs: [
        { category: "navigation", message: "/today" },
        { category: "console.error", message: "user grace@example.com hit 500" },
      ],
    });
    expect(out.breadcrumbs).toEqual([{ category: "navigation", message: "/today" }]);
  });

  it("drops user, request, contexts, extra wholesale", () => {
    const out = stripToCore({
      event_id: "abc",
      user: { id: "u_1" },
      request: { url: "x" },
      contexts: { device: { name: "iPhone" } },
      extra: { foo: "bar" },
    });
    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.contexts).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(out.event_id).toBe("abc");
  });

  it("preserves consent_state tag so pre-consent events are filterable", () => {
    const out = stripToCore({
      event_id: "abc",
      tags: { consent_state: "pre_consent", route: "/today" },
    });
    expect(out.tags?.consent_state).toBe("pre_consent");
  });

  it("post-consent flow (full event via redactPII) keeps level + exception + request URL", () => {
    // Sanity check that the post-consent redaction path retains the
    // operational shape Sentry dashboards rely on (level, exception
    // type/value, request url, fingerprint) while PII keys are gone.
    const out = redactPII({
      event_id: "abc",
      level: "error",
      fingerprint: ["NutritionApiError"],
      exception: { values: [{ type: "TypeError", value: "boom" }] },
      request: {
        url: "https://suppr.club/today",
        cookies: { session: "x" },
        headers: { authorization: "Bearer x" },
      },
      user: { id: "u_1", email: "g@x.com" },
      tags: { consent_state: "granted", route: "/today" },
    });
    expect(out.level).toBe("error");
    expect(out.exception?.values?.[0]?.value).toBe("boom");
    expect(out.fingerprint).toEqual(["NutritionApiError"]);
    expect(out.request?.url).toBe("https://suppr.club/today");
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers?.authorization).toBeUndefined();
    expect(out.user).toBeUndefined();
    expect(out.tags?.consent_state).toBe("granted");
  });
});
