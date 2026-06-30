/**
 * ENG-955 — weigh-in reminder server-fanout route tests.
 *
 * Exercises the auth → select → eligibility → dual-rail send → bookkeeping
 * chain of `app/api/push/weigh-in-reminder/route.ts` against a chainable fake
 * Supabase service-role client + a mocked Expo fetch + a mocked Web Push
 * fan-out. Modelled on `weeklyRecapPushRoute.test.ts`.
 *
 * Guarantees the route pins:
 *   1. `X-Cron-Secret` required — 401 missing/wrong, 503 when unset server-side.
 *   2. Only opted-in users IN their chosen window with no weigh-in this period
 *      and outside the dedupe window are pushed (the core decides; the route
 *      wires it). The cadence/anti-nag unit coverage lives in
 *      `weighInReminder.test.ts` — here we pin that the route HONOURS it.
 *   3. After a successful Expo ticket the route stamps
 *      `last_weigh_in_reminder_sent_at`.
 *   4. DeviceNotRegistered tickets null `profiles.expo_push_token`.
 *   5. Web-only users are reached via Web Push and stamped.
 *   6. The warm copy is sent verbatim — no streak/badge/threat language.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.setConfig({ testTimeout: 15_000 });
});

type SelectResult = { data: unknown; error: unknown };

const tableResults: {
  profiles: SelectResult;
  web_push_subscriptions: SelectResult;
} = {
  profiles: { data: [], error: null },
  web_push_subscriptions: { data: [], error: null },
};

type UpdateCall = { table: string; payload: Record<string, unknown>; ids: string[] };
const updateCalls: UpdateCall[] = [];
type DeleteCall = { table: string; col: string; ids: string[] };
const deleteCalls: DeleteCall[] = [];
const lastSelectColumns: Record<string, string> = {};

function makeBuilder(tableKey: keyof typeof tableResults) {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    not: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    then: (resolve: (v: SelectResult) => unknown) => unknown;
  } = {
    eq: vi.fn(function eq(this: unknown) {
      return builder;
    }),
    not: vi.fn(function not(this: unknown) {
      return builder;
    }),
    in: vi.fn(function inCall(this: unknown) {
      return builder;
    }),
    range: vi.fn(async function range(this: unknown) {
      return tableResults[tableKey];
    }),
    then(resolve) {
      return Promise.resolve(tableResults[tableKey]).then(resolve);
    },
  };
  return builder;
}

let selectQueryBuilder = makeBuilder("profiles");

const supabaseMock = {
  from: vi.fn((table: string) => {
    const tableKey = (
      table === "web_push_subscriptions" ? table : "profiles"
    ) as keyof typeof tableResults;
    const builder = makeBuilder(tableKey);
    return {
      select: vi.fn((cols?: string) => {
        if (typeof cols === "string") lastSelectColumns[table] = cols;
        if (tableKey === "profiles") selectQueryBuilder = builder;
        return builder;
      }),
      update: vi.fn((payload: Record<string, unknown>) => ({
        in: vi.fn(async (_col: string, ids: string[]) => {
          updateCalls.push({ table, payload, ids });
          return { error: null };
        }),
      })),
      delete: vi.fn(() => ({
        in: vi.fn(async (col: string, ids: string[]) => {
          deleteCalls.push({ table, col, ids });
          return { error: null };
        }),
      })),
    };
  }),
};

vi.mock("@/lib/supabase/serverAdminClient", () => ({
  getSupabaseAdminClient: () => supabaseMock,
  requireSupabaseAdminClient: () => supabaseMock,
}));

// Bypass the tz/cadence window gate by forcing the core decision to "send"
// for any opted-in row — the cadence + anti-nag math is unit-tested in
// weighInReminder.test.ts. The route tests target fan-out + bookkeeping.
// We DON'T mock parseWeighInReminderPref so the opt-in gate is still real:
// a row with no weighInReminder pref is dropped before any rail work.
vi.mock("@/lib/push/weighInReminder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/push/weighInReminder")>();
  return {
    ...actual,
    decideWeighInReminder: (input: { pref: unknown }) =>
      input.pref
        ? { send: true, skipReason: null }
        : { send: false, skipReason: "not_opted_in" },
  };
});

const webPushFanoutMock = vi.fn(async (subs: Array<{ endpoint: string }>) => ({
  sent: subs.length,
  dead: [] as string[],
  failed: 0,
  vapidUnset: false,
}));
vi.mock("@/lib/push/webPushSend", () => ({
  sendWebPushFanout: (...args: unknown[]) =>
    (webPushFanoutMock as unknown as (...a: unknown[]) => unknown)(...args),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function loadRoute() {
  const mod = await import("../../app/api/push/weigh-in-reminder/route");
  return mod.POST;
}

function makeReq(opts: { secret?: string | null } = {}): Request {
  const url = new URL("http://localhost/api/push/weigh-in-reminder");
  const headers = new Headers();
  if (opts.secret !== null && opts.secret !== undefined) {
    headers.set("x-cron-secret", opts.secret);
  }
  return new Request(url, { method: "POST", headers });
}

/** A profile that the opt-in gate will keep (has a weighInReminder pref). */
function optedInProfile(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "user-x",
    expo_push_token: "ExponentPushToken[xxx]",
    last_weigh_in_reminder_sent_at: null,
    tz_iana: "Europe/London",
    weight_kg_by_day: {},
    notification_prefs: { weighInReminder: { enabled: true, weekday: 1, hour: 8 } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("SUPPR_CRON_SECRET", "test-cron-secret");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-xxx");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
  fetchMock.mockReset();
  supabaseMock.from.mockClear();
  updateCalls.length = 0;
  deleteCalls.length = 0;
  tableResults.profiles = { data: [], error: null };
  tableResults.web_push_subscriptions = { data: [], error: null };
  webPushFanoutMock.mockReset();
  webPushFanoutMock.mockImplementation(async (subs: Array<{ endpoint: string }>) => ({
    sent: subs.length,
    dead: [] as string[],
    failed: 0,
    vapidUnset: false,
  }));
  for (const k of Object.keys(lastSelectColumns)) delete lastSelectColumns[k];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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
  });

  it("returns 503 when SUPPR_CRON_SECRET is unset on the server", async () => {
    vi.stubEnv("SUPPR_CRON_SECRET", "");
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "anything" }));
    expect(res.status).toBe(503);
  });
});

describe("select + opt-in gate", () => {
  it("requests the weigh-in column set and filters on a non-null notification_prefs", async () => {
    tableResults.profiles = { data: [], error: null };
    const POST = await loadRoute();
    await POST(makeReq({ secret: "test-cron-secret" }));
    const cols = lastSelectColumns["profiles"] ?? "";
    expect(cols).toContain("last_weigh_in_reminder_sent_at");
    expect(cols).toContain("notification_prefs");
    expect(cols).toContain("weight_kg_by_day");
    expect(cols).toContain("tz_iana");
    const notFilter = selectQueryBuilder.not.mock.calls.find(
      (args) => args[0] === "notification_prefs",
    );
    expect(notFilter).toBeTruthy();
    expect(selectQueryBuilder.range).toHaveBeenCalledWith(0, 4999);
  });

  it("drops a row with no weigh-in reminder opt-in before any rail work", async () => {
    tableResults.profiles = {
      data: [
        // No weighInReminder pref → opt-in gate drops it.
        optedInProfile({ id: "user-noopt", notification_prefs: { weekSummaryMode: "rolling" } }),
      ],
      error: null,
    };
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 0, succeeded: 0, deregistered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    // No web_push_subscriptions lookup for an empty eligible set.
    const webCalls = supabaseMock.from.mock.calls.filter(
      (c) => c[0] === "web_push_subscriptions",
    );
    expect(webCalls.length).toBe(0);
  });
});

describe("mobile fan-out + bookkeeping", () => {
  it("sends the warm copy via Expo and stamps last_weigh_in_reminder_sent_at", async () => {
    tableResults.profiles = {
      data: [
        optedInProfile({ id: "user-a", expo_push_token: "ExponentPushToken[a]" }),
        optedInProfile({ id: "user-b", expo_push_token: "ExponentPushToken[b]" }),
      ],
      error: null,
    };
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ status: "ok", id: "tk-a" }, { status: "ok", id: "tk-b" }] }),
    );

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 2, succeeded: 2, deregistered: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(String((init as RequestInit).body));
    expect(sent).toHaveLength(2);
    expect(sent[0].title).toBe("Weekly weigh-in");
    expect(sent[0].body).toBe(
      "Ready for a quick weigh-in? Mornings give the steadiest trend.",
    );
    // Warm copy carries no streak/badge/threat language.
    const haystack = `${sent[0].title} ${sent[0].body}`.toLowerCase();
    for (const banned of ["streak", "badge", "don't lose", "miss", "broken"]) {
      expect(haystack).not.toContain(banned);
    }
    expect(sent[0].data).toMatchObject({ deepLink: "/progress", kind: "weigh_in_reminder" });

    const stamp = updateCalls.find(
      (c) => c.payload.last_weigh_in_reminder_sent_at !== undefined,
    );
    expect(stamp?.ids.sort()).toEqual(["user-a", "user-b"]);
    expect(typeof stamp?.payload.last_weigh_in_reminder_sent_at).toBe("string");
  });

  it("nulls expo_push_token for DeviceNotRegistered tickets", async () => {
    tableResults.profiles = {
      data: [
        optedInProfile({ id: "user-live", expo_push_token: "ExponentPushToken[live]" }),
        optedInProfile({ id: "user-dead", expo_push_token: "ExponentPushToken[dead]" }),
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
            details: { error: "DeviceNotRegistered", expoPushToken: "ExponentPushToken[dead]" },
          },
        ],
      }),
    );

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 2, succeeded: 1, deregistered: 1 });

    const stamp = updateCalls.find(
      (c) => c.payload.last_weigh_in_reminder_sent_at !== undefined,
    );
    expect(stamp?.ids).toEqual(["user-live"]);
    const dereg = updateCalls.find((c) => c.payload.expo_push_token === null);
    expect(dereg?.ids).toEqual(["user-dead"]);
  });

  it("responds 200 with zero counts when no opted-in rows exist", async () => {
    tableResults.profiles = { data: [], error: null };
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 0, succeeded: 0, deregistered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the profiles select errors", async () => {
    tableResults.profiles = { data: null, error: { message: "boom" } };
    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "select_failed" });
  });
});

describe("web-push fan-out", () => {
  function webSub(userId: string, endpoint: string) {
    return { user_id: userId, endpoint, p256dh: `p-${endpoint}`, auth: `a-${endpoint}` };
  }

  it("reaches a web-only user (no expo token) and stamps them with the warm copy", async () => {
    tableResults.profiles = {
      data: [optedInProfile({ id: "user-web", expo_push_token: null })],
      error: null,
    };
    tableResults.web_push_subscriptions = {
      data: [webSub("user-web", "https://push.example/web-1")],
      error: null,
    };

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 1, succeeded: 1, deregistered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();

    expect(webPushFanoutMock).toHaveBeenCalledTimes(1);
    const [subs, payload] = webPushFanoutMock.mock.calls[0] as [
      Array<{ endpoint: string }>,
      { title: string; body: string; url: string; tag: string },
    ];
    expect(subs).toHaveLength(1);
    expect(payload.title).toBe("Weekly weigh-in");
    expect(payload.body).toBe(
      "Ready for a quick weigh-in? Mornings give the steadiest trend.",
    );
    expect(payload.url).toBe("/home?view=progress");
    expect(payload.tag).toBe("weigh_in_reminder");

    const stamp = updateCalls.find(
      (c) => c.payload.last_weigh_in_reminder_sent_at !== undefined,
    );
    expect(stamp?.ids).toEqual(["user-web"]);
  });

  it("does NOT stamp a web-only user when VAPID is unset (no delivery)", async () => {
    tableResults.profiles = {
      data: [optedInProfile({ id: "user-web", expo_push_token: null })],
      error: null,
    };
    tableResults.web_push_subscriptions = {
      data: [webSub("user-web", "https://push.example/web-1")],
      error: null,
    };
    webPushFanoutMock.mockImplementation(async () => ({
      sent: 0,
      dead: [] as string[],
      failed: 0,
      vapidUnset: true,
    }));

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 1, succeeded: 0, deregistered: 0 });
    const stamp = updateCalls.find(
      (c) => c.payload.last_weigh_in_reminder_sent_at !== undefined,
    );
    expect(stamp).toBeUndefined();
  });

  it("deletes dead web-push endpoints returned by the sender", async () => {
    tableResults.profiles = {
      data: [optedInProfile({ id: "user-web", expo_push_token: null })],
      error: null,
    };
    tableResults.web_push_subscriptions = {
      data: [
        webSub("user-web", "https://push.example/live"),
        webSub("user-web", "https://push.example/dead"),
      ],
      error: null,
    };
    webPushFanoutMock.mockImplementation(async () => ({
      sent: 1,
      dead: ["https://push.example/dead"],
      failed: 0,
      vapidUnset: false,
    }));

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 1, succeeded: 1, deregistered: 0 });
    const del = deleteCalls.find((c) => c.table === "web_push_subscriptions");
    expect(del?.col).toBe("endpoint");
    expect(del?.ids).toEqual(["https://push.example/dead"]);
  });

  it("drops an opted-in user with NEITHER rail before any send", async () => {
    tableResults.profiles = {
      data: [optedInProfile({ id: "user-norail", expo_push_token: null })],
      error: null,
    };
    tableResults.web_push_subscriptions = { data: [], error: null };

    const POST = await loadRoute();
    const res = await POST(makeReq({ secret: "test-cron-secret" }));
    const body = await res.json();
    expect(body).toEqual({ ok: true, attempted: 0, succeeded: 0, deregistered: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(webPushFanoutMock).not.toHaveBeenCalled();
  });
});
