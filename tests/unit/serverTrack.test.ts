/**
 * Tests for the server-side analytics emit (Sunday push rewrite — T6,
 * 2026-04-19).
 *
 * Pin the contract the weekly-recap route depends on:
 *   - No-ops cleanly when the project key is missing (no network call).
 *   - POSTs to PostHog `/capture/` with the canonical body shape.
 *   - Returns ok=false on non-2xx responses (used by structured logs).
 *   - Tolerates fetch throwing (ok=false, no throw bubbled up).
 */

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_POSTHOG_HOST,
  serverTrack,
} from "../../src/lib/analytics/serverTrack";

function okResp(): Response {
  return new Response(JSON.stringify({ status: 1 }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("serverTrack — happy path", () => {
  it("POSTs to PostHog /capture/ with api_key, event, distinct_id, properties", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResp());
    const out = await serverTrack(
      "weekly_recap_push_sent",
      "user-a",
      { weekKey: "2026-W15", bodyVariant: "with_weight", suggestionRule: null },
      { fetchImpl: fetchMock as unknown as typeof fetch, projectKey: "phc_test" },
    );
    expect(out).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${DEFAULT_POSTHOG_HOST}/capture/`);
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      api_key: "phc_test",
      event: "weekly_recap_push_sent",
      distinct_id: "user-a",
      properties: {
        weekKey: "2026-W15",
        bodyVariant: "with_weight",
        suggestionRule: null,
      },
    });
    expect(typeof body.timestamp).toBe("string");
  });

  it("honours the host override", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResp());
    await serverTrack(
      "weekly_recap_push_sent",
      "user-a",
      {},
      {
        fetchImpl: fetchMock as unknown as typeof fetch,
        projectKey: "k",
        host: "https://eu.i.posthog.com",
      },
    );
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://eu.i.posthog.com/capture/",
    );
  });
});

describe("serverTrack — degraded paths", () => {
  it("returns ok=false and does not POST when projectKey is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResp());
    const out = await serverTrack(
      "weekly_recap_push_sent",
      "user-a",
      {},
      { fetchImpl: fetchMock as unknown as typeof fetch, projectKey: "" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("no_project_key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns ok=false on non-2xx response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 500 }));
    const out = await serverTrack(
      "weekly_recap_push_sent",
      "user-a",
      {},
      { fetchImpl: fetchMock as unknown as typeof fetch, projectKey: "k" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("status_500");
  });

  it("returns ok=false and never throws on fetch error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    const out = await serverTrack(
      "weekly_recap_push_sent",
      "user-a",
      {},
      { fetchImpl: fetchMock as unknown as typeof fetch, projectKey: "k" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/fetch_error/);
  });

  it("rejects empty distinct_id (cannot attribute to a user)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResp());
    const out = await serverTrack(
      "weekly_recap_push_sent",
      "",
      {},
      { fetchImpl: fetchMock as unknown as typeof fetch, projectKey: "k" },
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("invalid_distinct_id");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
