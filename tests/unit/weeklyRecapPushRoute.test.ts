/**
 * Weekly recap server-fanout route tests (TestFlight build 10 fix C).
 *
 * Exercises the full auth → query → send → bookkeeping chain of
 * `app/api/push/weekly-recap/route.ts` against:
 *   - a chainable fake Supabase service-role client (mocked via the
 *     `@/lib/supabase/serverAdminClient` module boundary)
 *   - a mocked `fetch` standing in for the Expo push API
 *
 * Guarantees the route pins:
 *   1. `X-Cron-Secret` is required — 401 when missing or wrong.
 *   2. The select filters on `weekly_recap_push_enabled = true` and a
 *      non-null `expo_push_token`.
 *   3. Rows whose `last_weekly_recap_push_sent_at` is within 6 days are
 *      skipped (dedupe).
 *   4. After a successful Expo ticket the route writes
 *      `last_weekly_recap_push_sent_at = now()` for that user.
 *   5. For `DeviceNotRegistered` tickets the route nulls
 *      `profiles.expo_push_token` so we stop pushing to dead installs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Supabase admin client mock ---------------------------------------------

type SelectResult = { data: unknown; error: unknown };
const selectResult: { current: SelectResult } = { current: { data: [], error: null } };

type UpdateCall = {
  payload: Record<string, unknown>;
  ids: string[];
};
const updateCalls: UpdateCall[] = [];

const selectQueryBuilder = {
  eq: vi.fn(function eq(this: unknown) {
    return selectQueryBuilder;
  }),
  not: vi.fn(function not(this: unknown) {
    return selectQueryBuilder;
  }),
  range: vi.fn(async function range(this: unknown) {
    return selectResult.current;
  }),
};

function freshBuilder() {
  selectQueryBuilder.eq.mockClear();
  selectQueryBuilder.not.mockClear();
  selectQueryBuilder.range.mockClear();
}

const supabaseMock = {
  from: vi.fn((_table: string) => ({
    select: vi.fn(() => {
      freshBuilder();
      return selectQueryBuilder;
    }),
    update: vi.fn((payload: Record<string, unknown>) => ({
      in: vi.fn(async (_col: string, ids: string[]) => {
        updateCalls.push({ payload, ids });
        return { error: null };
      }),
    })),
  })),
};

vi.mock("@/lib/supabase/serverAdminClient", () => ({
  getSupabaseAdminClient: () => supabaseMock,
  requireSupabaseAdminClient: () => supabaseMock,
}));

// --- fetch mock -------------------------------------------------------------

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- helpers ----------------------------------------------------------------

async function loadRoute() {
  // Fresh import per-test so vi.stubEnv changes are picked up by the
  // module-top `process.env.SUPPR_CRON_SECRET` read inside POST.
  const mod = await import("../../app/api/push/weekly-recap/route");
  return mod.POST;
}

function makeReq(
  opts: { secret?: string | null; cohort?: string | null } = {},
): Request {
  const url = new URL("http://localhost/api/push/weekly-recap");
  if (opts.cohort) url.searchParams.set("weekStartDay", opts.cohort);
  const headers = new Headers();
  if (opts.secret !== null && opts.secret !== undefined) {
    headers.set("x-cron-secret", opts.secret);
  }
  return new Request(url, { method: "POST", headers });
}

beforeEach(() => {
  vi.stubEnv("SUPPR_CRON_SECRET", "test-cron-secret");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-xxx");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  fetchMock.mockReset();
  supabaseMock.from.mockClear();
  updateCalls.length = 0;
  selectResult.current = { data: [], error: null };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- auth gate --------------------------------------------------------------

describe("auth gate", () => {
  it("returns 401 when the X-Cron-Secret header is missing", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: null }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("returns 401 when the X-Cron-Secret header is wrong", async () => {
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "nope" }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when SUPPR_CRON_SECRET is unset on the server", async () => {
    vi.stubEnv("SUPPR_CRON_SECRET", "");
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "anything" }));
    expect(res.status).toBe(503);
  });
});

// --- fan-out flow -----------------------------------------------------------

describe("fan-out flow", () => {
  it("fans out to enabled rows with tokens and stamps last_weekly_recap_push_sent_at", async () => {
    selectResult.current = {
      data: [
        {
          id: "user-a",
          expo_push_token: "ExponentPushToken[aaa]",
          last_weekly_recap_push_sent_at: null,
          week_start_day: "monday",
        },
        {
          id: "user-b",
          expo_push_token: "ExponentPushToken[bbb]",
          last_weekly_recap_push_sent_at: null,
          week_start_day: "monday",
        },
      ],
      error: null,
    };

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { status: "ok", id: "tk-a" },
          { status: "ok", id: "tk-b" },
        ],
      }),
    );

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 2, succeeded: 2, deregistered: 0 });

    // Select filters on the right columns.
    expect(selectQueryBuilder.eq).toHaveBeenCalledWith("weekly_recap_push_enabled", true);
    expect(selectQueryBuilder.not).toHaveBeenCalledWith("expo_push_token", "is", null);
    expect(selectQueryBuilder.range).toHaveBeenCalledWith(0, 4999);

    // Expo push API hit once with two messages.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const sentMessages = JSON.parse(String((init as RequestInit).body));
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0].to).toBe("ExponentPushToken[aaa]");
    expect(sentMessages[0].title).toBe("Your week in Suppr");
    expect(sentMessages[0].data).toEqual({
      deepLink: "/progress",
      kind: "weekly_recap",
    });

    // Bookkeeping: exactly one UPDATE for the success stamp, targeting
    // both user ids.
    const stamp = updateCalls.find(
      (c) => c.payload.last_weekly_recap_push_sent_at !== undefined,
    );
    expect(stamp).toBeTruthy();
    expect(stamp?.ids.sort()).toEqual(["user-a", "user-b"]);
    expect(typeof stamp?.payload.last_weekly_recap_push_sent_at).toBe("string");

    // No deregister update because no DeviceNotRegistered tickets.
    const dereg = updateCalls.find((c) => c.payload.expo_push_token === null);
    expect(dereg).toBeFalsy();
  });

  it("skips rows with last_weekly_recap_push_sent_at within the last 6 days", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    selectResult.current = {
      data: [
        {
          id: "user-recent",
          expo_push_token: "ExponentPushToken[r]",
          last_weekly_recap_push_sent_at: twoDaysAgo,
          week_start_day: "monday",
        },
        {
          id: "user-stale",
          expo_push_token: "ExponentPushToken[s]",
          last_weekly_recap_push_sent_at: eightDaysAgo,
          week_start_day: "monday",
        },
      ],
      error: null,
    };

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ status: "ok", id: "tk-s" }] }),
    );

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 1, succeeded: 1, deregistered: 0 });

    const [, init] = fetchMock.mock.calls[0];
    const sentMessages = JSON.parse(String((init as RequestInit).body));
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].to).toBe("ExponentPushToken[s]");

    const stamp = updateCalls.find(
      (c) => c.payload.last_weekly_recap_push_sent_at !== undefined,
    );
    expect(stamp?.ids).toEqual(["user-stale"]);
  });

  it("nulls expo_push_token for users whose ticket was DeviceNotRegistered", async () => {
    selectResult.current = {
      data: [
        {
          id: "user-live",
          expo_push_token: "ExponentPushToken[live]",
          last_weekly_recap_push_sent_at: null,
          week_start_day: "sunday",
        },
        {
          id: "user-dead",
          expo_push_token: "ExponentPushToken[dead]",
          last_weekly_recap_push_sent_at: null,
          week_start_day: "sunday",
        },
      ],
      error: null,
    };

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { status: "ok", id: "tk-live" },
          {
            status: "error",
            message: "gone",
            details: {
              error: "DeviceNotRegistered",
              expoPushToken: "ExponentPushToken[dead]",
            },
          },
        ],
      }),
    );

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 2, succeeded: 1, deregistered: 1 });

    const stamp = updateCalls.find(
      (c) => c.payload.last_weekly_recap_push_sent_at !== undefined,
    );
    expect(stamp?.ids).toEqual(["user-live"]);

    const dereg = updateCalls.find((c) => c.payload.expo_push_token === null);
    expect(dereg?.ids).toEqual(["user-dead"]);
  });

  it("forwards weekStartDay to the query when the cohort param is present", async () => {
    selectResult.current = { data: [], error: null };
    const POST = await loadRoute();
    await POST(makeReq({ secret: "test-cron-secret", cohort: "monday" }));
    expect(selectQueryBuilder.eq).toHaveBeenCalledWith("week_start_day", "monday");
  });

  it("ignores bogus weekStartDay values", async () => {
    selectResult.current = { data: [], error: null };
    const POST = await loadRoute();
    await POST(makeReq({ secret: "test-cron-secret", cohort: "garbage" }));
    const cohortCall = selectQueryBuilder.eq.mock.calls.find(
      (args) => args[0] === "week_start_day",
    );
    expect(cohortCall).toBeUndefined();
  });

  it("responds 200 with zero counts when no eligible rows exist", async () => {
    selectResult.current = { data: [], error: null };
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 0, succeeded: 0, deregistered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
