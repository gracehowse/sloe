/**
 * Expo push helper tests (TestFlight build 10 fix C).
 *
 * Pins the network contract for `sendExpoPush`:
 *   - batches are chunked at the 100-message Expo limit
 *   - 5xx / network failures retry exactly once with a bounded delay
 *   - 4xx failures do NOT retry (caller bug, not a transient error)
 *   - `DeviceNotRegistered` tickets are extracted for caller cleanup
 *   - Tokens that don't match the ExponentPushToken regex never reach
 *     the wire — one typo cannot poison the whole batch.
 *
 * All tests run with a mocked `fetch`; the helper itself never touches
 * Supabase so no DB mock is needed.
 */
import { describe, expect, it, vi } from "vitest";

import {
  EXPO_PUSH_API_URL,
  EXPO_PUSH_MAX_BATCH,
  isValidExpoPushToken,
  sendExpoPush,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from "@/lib/push/expoPush";

function makeMessage(token: string): ExpoPushMessage {
  return {
    to: token,
    title: "Your week in Sloe",
    body: "Tap to see your weekly recap — avg calories, protein, streak, and weight trend.",
    data: { deepLink: "/progress", kind: "weekly_recap" },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function okTicket(id: string): ExpoPushTicket {
  return { status: "ok", id };
}

describe("isValidExpoPushToken", () => {
  it("accepts both ExponentPushToken[...] and ExpoPushToken[...] shapes", () => {
    expect(isValidExpoPushToken("ExponentPushToken[abc123]")).toBe(true);
    expect(isValidExpoPushToken("ExpoPushToken[abc123]")).toBe(true);
  });

  it("rejects empty / malformed tokens", () => {
    expect(isValidExpoPushToken("")).toBe(false);
    expect(isValidExpoPushToken("abc")).toBe(false);
    expect(isValidExpoPushToken("ExponentPushToken[]")).toBe(false);
    expect(isValidExpoPushToken(null)).toBe(false);
    expect(isValidExpoPushToken(undefined)).toBe(false);
    expect(isValidExpoPushToken(42)).toBe(false);
  });
});

describe("sendExpoPush — chunking", () => {
  it("sends a single batch when under the 100-message cap", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: [okTicket("tk-1"), okTicket("tk-2")] }),
    );
    const messages = [
      makeMessage("ExponentPushToken[a]"),
      makeMessage("ExponentPushToken[b]"),
    ];

    const result = await sendExpoPush(messages, { fetchImpl: fetchMock });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      EXPO_PUSH_API_URL,
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.tickets).toHaveLength(2);
    expect(result.deregisteredTokens).toEqual([]);
    expect(result.invalidTokens).toEqual([]);
  });

  it("chunks at exactly 100 messages per POST", async () => {
    const calls: string[][] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as ExpoPushMessage[];
      calls.push(body.map((m) => m.to));
      return jsonResponse({ data: body.map((_, i) => okTicket(`tk-${calls.length}-${i}`)) });
    });

    const N = 250; // → 3 chunks (100 + 100 + 50)
    const messages = Array.from({ length: N }, (_, i) =>
      makeMessage(`ExponentPushToken[${i}]`),
    );
    const result = await sendExpoPush(messages, { fetchImpl: fetchMock });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls[0]).toHaveLength(EXPO_PUSH_MAX_BATCH);
    expect(calls[1]).toHaveLength(EXPO_PUSH_MAX_BATCH);
    expect(calls[2]).toHaveLength(N - 2 * EXPO_PUSH_MAX_BATCH);
    expect(result.tickets).toHaveLength(N);
  });
});

describe("sendExpoPush — retry semantics", () => {
  it("retries exactly once on 500 and succeeds on the second attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500))
      .mockResolvedValueOnce(jsonResponse({ data: [okTicket("tk-1")] }));

    const result = await sendExpoPush([makeMessage("ExponentPushToken[a]")], {
      fetchImpl: fetchMock as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.tickets).toEqual([okTicket("tk-1")]);
  });

  it("does not retry on 400 — caller bug, not a transient failure", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "bad" }, 400));
    const result = await sendExpoPush([makeMessage("ExponentPushToken[a]")], {
      fetchImpl: fetchMock as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(400);
  });

  it("surfaces a structured error when both attempts fail with 503", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "down" }, 503));
    const result = await sendExpoPush([makeMessage("ExponentPushToken[a]")], {
      fetchImpl: fetchMock as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(503);
    expect(result.error).toMatch(/failed after retry/);
  });

  it("retries once on network error (rejected fetch) then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network blip"))
      .mockResolvedValueOnce(jsonResponse({ data: [okTicket("tk-1")] }));
    const result = await sendExpoPush([makeMessage("ExponentPushToken[a]")], {
      fetchImpl: fetchMock as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
  });
});

describe("sendExpoPush — DeviceNotRegistered extraction", () => {
  it("returns the offending token in `deregisteredTokens`", async () => {
    const deadToken = "ExponentPushToken[dead]";
    const liveToken = "ExponentPushToken[live]";
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [
          okTicket("tk-live"),
          {
            status: "error",
            message: "The recipient device is not registered with FCM/APNs.",
            details: { error: "DeviceNotRegistered", expoPushToken: deadToken },
          } satisfies ExpoPushTicket,
        ],
      }),
    );

    const result = await sendExpoPush(
      [makeMessage(liveToken), makeMessage(deadToken)],
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deregisteredTokens).toEqual([deadToken]);
  });

  it("falls back to the index-matched input token when Expo does not echo one", async () => {
    const deadToken = "ExponentPushToken[dead]";
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            status: "error",
            message: "gone",
            details: { error: "DeviceNotRegistered" },
          } satisfies ExpoPushTicket,
        ],
      }),
    );
    const result = await sendExpoPush([makeMessage(deadToken)], {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deregisteredTokens).toEqual([deadToken]);
  });

  it("does not mark non-DeviceNotRegistered errors as deregistered", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            status: "error",
            message: "too big",
            details: { error: "MessageTooBig" },
          } satisfies ExpoPushTicket,
        ],
      }),
    );
    const result = await sendExpoPush([makeMessage("ExponentPushToken[a]")], {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deregisteredTokens).toEqual([]);
  });
});

describe("sendExpoPush — invalid token filtering", () => {
  it("skips bad tokens before POSTing and records them in `invalidTokens`", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: [okTicket("tk-1")] }),
    );
    const result = await sendExpoPush(
      [
        makeMessage("ExponentPushToken[valid]"),
        makeMessage("not-a-real-token"),
        makeMessage(""),
      ],
      { fetchImpl: fetchMock as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Only the valid one hits the wire.
    const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as ExpoPushMessage[];
    expect(body).toHaveLength(1);
    expect(body[0].to).toBe("ExponentPushToken[valid]");

    expect(result.invalidTokens).toEqual(["not-a-real-token", ""]);
    expect(result.tickets).toHaveLength(1);
  });

  it("short-circuits with an empty result when every token is invalid", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }));
    const result = await sendExpoPush([makeMessage("bad")], {
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.tickets).toEqual([]);
    expect(result.invalidTokens).toEqual(["bad"]);
  });
});
