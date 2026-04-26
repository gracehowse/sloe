/**
 * Server-side Web Push sender — contract coverage.
 *
 * Asserts the VAPID-unset short-circuit + the fan-out result shape.
 * We stub the `web-push` module so tests don't make real HTTPS
 * requests to push services.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

describe("sendWebPush", () => {
  // Heavy `vi.doMock` + `vi.resetModules` per-test churn made this
  // file flake under full-suite parallel load (5s default timeout
  // exceeded on cold cache). Each test passes in <50ms in isolation;
  // the timeout headroom is for resource contention, not real work.
  beforeAll(() => {
    vi.setConfig({ testTimeout: 15_000 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns vapid_unset without calling web-push when env is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    const { sendWebPush } = await import("@/lib/push/webPushSend");
    const result = await sendWebPush(
      { endpoint: "https://push.example", p256dh: "k", auth: "a" },
      { title: "t", body: "b" },
    );
    expect(result).toEqual({ ok: false, reason: "vapid_unset" });
  });

  it("maps a 410 Gone statusCode to { ok: false, reason: 'gone' }", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");

    vi.doMock("web-push", () => ({
      default: {
        setVapidDetails: vi.fn(),
        sendNotification: vi.fn(async () => {
          const err = new Error("Gone") as Error & { statusCode?: number };
          err.statusCode = 410;
          throw err;
        }),
      },
    }));

    const { sendWebPush } = await import("@/lib/push/webPushSend");
    const result = await sendWebPush(
      { endpoint: "https://push.example/x", p256dh: "k", auth: "a" },
      { title: "t", body: "b" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("gone");
      expect(result.status).toBe(410);
    }
  });
});

describe("sendWebPushFanout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("aggregates dead endpoints + sent count across subscriptions", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");

    const sendNotification = vi
      .fn()
      .mockImplementationOnce(async () => undefined) // first subscription: ok
      .mockImplementationOnce(async () => {
        const err = new Error("Gone") as Error & { statusCode?: number };
        err.statusCode = 410;
        throw err;
      }) // second: gone
      .mockImplementationOnce(async () => undefined); // third: ok

    vi.doMock("web-push", () => ({
      default: {
        setVapidDetails: vi.fn(),
        sendNotification,
      },
    }));

    const { sendWebPushFanout } = await import("@/lib/push/webPushSend");
    const result = await sendWebPushFanout(
      [
        { endpoint: "https://push/1", p256dh: "k1", auth: "a1" },
        { endpoint: "https://push/2", p256dh: "k2", auth: "a2" },
        { endpoint: "https://push/3", p256dh: "k3", auth: "a3" },
      ],
      { title: "t", body: "b" },
    );
    expect(result.sent).toBe(2);
    expect(result.dead).toEqual(["https://push/2"]);
    expect(result.failed).toBe(0);
    expect(result.vapidUnset).toBe(false);
  });

  it("short-circuits on vapid_unset (doesn't try every row)", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");
    const { sendWebPushFanout } = await import("@/lib/push/webPushSend");
    const result = await sendWebPushFanout(
      [
        { endpoint: "https://push/1", p256dh: "k", auth: "a" },
        { endpoint: "https://push/2", p256dh: "k", auth: "a" },
      ],
      { title: "t", body: "b" },
    );
    expect(result.vapidUnset).toBe(true);
    expect(result.sent).toBe(0);
    expect(result.dead).toEqual([]);
  });
});
