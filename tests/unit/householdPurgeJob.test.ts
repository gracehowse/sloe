/**
 * `app/api/cron/household-purge` — ENG-1359 tests.
 *
 * Household purge fills the gap the `leaveHousehold` disband branch
 * had promised for since 2026-05-01: a scheduled job that hard-deletes
 * households once `disbanded_at` has aged past the 30-day retention
 * window. Pins:
 *   1. The auth gate (missing/wrong `X-Cron-Secret` → 503 / 401).
 *   2. Households disbanded < 30 days ago are left untouched.
 *   3. Households disbanded >= 30 days ago are deleted, and every
 *      dependent row (members, meals, invites, shopping items) is
 *      gone too — simulating the real FK CASCADE behaviour so the
 *      "no orphaned rows" contract is exercised end to end.
 *   4. Zero eligible households is a clean 200 (`deletedCount: 0`),
 *      not an error.
 *   5. A second run against an already-purged household is a no-op
 *      (idempotent).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  runHouseholdPurge,
  runHouseholdPurgeRoute,
  safeCompare,
  HOUSEHOLD_PURGE_RETENTION_DAYS,
} from "../../src/lib/server/householdPurgeJob";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * In-memory fake standing in for the full relational graph a real
 * Postgres FK CASCADE would enforce: households, and everything that
 * references household_id (household_members, household_meals,
 * household_invites, shopping_items) or references households with
 * ON DELETE SET NULL (profiles). Deleting a household row here also
 * removes/nulls dependents, exactly like the live schema's FKs do —
 * this is what lets the "no orphaned rows" test assert against
 * something meaningful instead of just checking the households table.
 */
interface FakeDb {
  households: Array<{ id: string; disbanded_at: string | null }>;
  household_members: Array<{ id: string; household_id: string }>;
  household_meals: Array<{ id: string; household_id: string }>;
  household_invites: Array<{ id: string; household_id: string }>;
  shopping_items: Array<{ id: string; household_id: string | null }>;
  profiles: Array<{ id: string; household_id: string | null }>;
}

function makeFakeSupabase(db: FakeDb) {
  return {
    from(table: keyof FakeDb) {
      return {
        select(_cols: string) {
          // select-then-filter chain used by runHouseholdPurge's
          // eligibility query: .select("id").not("disbanded_at", "is", null).lte("disbanded_at", cutoff)
          const rows = db[table] as any[];
          return {
            not(column: string, _op: string, _value: null) {
              const filtered = rows.filter((r) => r[column] !== null && r[column] !== undefined);
              return {
                async lte(column2: string, value: string) {
                  const result = filtered.filter((r) => r[column2] <= value);
                  return { data: result.map((r) => ({ id: r.id })), error: null };
                },
              };
            },
          };
        },
        delete() {
          return {
            in(column: string, values: string[]) {
              return {
                select(_cols: string) {
                  // Simulate FK CASCADE: remove the household rows,
                  // then every dependent row across the graph.
                  const rows = db.households;
                  const toDelete = rows.filter((r) => values.includes((r as any)[column]));
                  const deletedIds = toDelete.map((r) => r.id);
                  db.households = rows.filter((r) => !deletedIds.includes(r.id));

                  db.household_members = db.household_members.filter(
                    (m) => !deletedIds.includes(m.household_id),
                  );
                  db.household_meals = db.household_meals.filter(
                    (m) => !deletedIds.includes(m.household_id),
                  );
                  db.household_invites = db.household_invites.filter(
                    (m) => !deletedIds.includes(m.household_id),
                  );
                  db.shopping_items = db.shopping_items.filter(
                    (s) => !(s.household_id && deletedIds.includes(s.household_id)),
                  );
                  // ON DELETE SET NULL, not cascade delete.
                  db.profiles = db.profiles.map((p) =>
                    p.household_id && deletedIds.includes(p.household_id)
                      ? { ...p, household_id: null }
                      : p,
                  );

                  return Promise.resolve({
                    data: deletedIds.map((id) => ({ id })),
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  } as any;
}

function freshDb(): FakeDb {
  return {
    households: [],
    household_members: [],
    household_meals: [],
    household_invites: [],
    shopping_items: [],
    profiles: [],
  };
}

describe("runHouseholdPurge — core logic", () => {
  const NOW = new Date("2026-07-05T12:00:00.000Z");

  it("leaves households disbanded fewer than 30 days ago untouched", async () => {
    const db = freshDb();
    const recentlyDisbanded = new Date(NOW.getTime() - 10 * DAY_MS).toISOString();
    db.households.push({ id: "h-recent", disbanded_at: recentlyDisbanded });
    db.household_members.push({ id: "m-1", household_id: "h-recent" });

    const supabase = makeFakeSupabase(db);
    const summary = await runHouseholdPurge(supabase, NOW);

    expect(summary.ok).toBe(true);
    expect(summary.deletedCount).toBe(0);
    expect(summary.eligibleCount).toBe(0);
    expect(db.households).toHaveLength(1);
    expect(db.household_members).toHaveLength(1);
  });

  it("leaves never-disbanded (active) households untouched", async () => {
    const db = freshDb();
    db.households.push({ id: "h-active", disbanded_at: null });

    const supabase = makeFakeSupabase(db);
    const summary = await runHouseholdPurge(supabase, NOW);

    expect(summary.deletedCount).toBe(0);
    expect(db.households).toHaveLength(1);
  });

  it("deletes households disbanded 30+ days ago along with dependent rows (no orphans)", async () => {
    const db = freshDb();
    const oldEnough = new Date(
      NOW.getTime() - (HOUSEHOLD_PURGE_RETENTION_DAYS + 1) * DAY_MS,
    ).toISOString();
    db.households.push({ id: "h-old", disbanded_at: oldEnough });
    db.household_members.push({ id: "m-1", household_id: "h-old" });
    db.household_members.push({ id: "m-2", household_id: "h-old" });
    db.household_meals.push({ id: "meal-1", household_id: "h-old" });
    db.household_invites.push({ id: "inv-1", household_id: "h-old" });
    db.shopping_items.push({ id: "item-1", household_id: "h-old" });
    // A per-user shopping item (household_id null) belonging to an
    // unrelated user must never be touched.
    db.shopping_items.push({ id: "item-solo", household_id: null });
    db.profiles.push({ id: "user-1", household_id: "h-old" });

    const supabase = makeFakeSupabase(db);
    const summary = await runHouseholdPurge(supabase, NOW);

    expect(summary.ok).toBe(true);
    expect(summary.eligibleCount).toBe(1);
    expect(summary.deletedCount).toBe(1);

    // Household itself is gone.
    expect(db.households).toHaveLength(0);
    // Every dependent row referencing it is gone too — no orphans.
    expect(db.household_members).toHaveLength(0);
    expect(db.household_meals).toHaveLength(0);
    expect(db.household_invites).toHaveLength(0);
    expect(db.shopping_items.find((i) => i.id === "item-1")).toBeUndefined();
    // Unrelated per-user shopping item survives untouched.
    expect(db.shopping_items.find((i) => i.id === "item-solo")).toBeDefined();
    // Profile row survives; only its household_id link is cleared
    // (ON DELETE SET NULL) — deleting a stale household must never
    // delete a user's profile.
    const profile = db.profiles.find((p) => p.id === "user-1");
    expect(profile).toBeDefined();
    expect(profile?.household_id).toBeNull();
  });

  it("handles zero households-to-delete gracefully", async () => {
    const db = freshDb();
    const supabase = makeFakeSupabase(db);
    const summary = await runHouseholdPurge(supabase, NOW);

    expect(summary.ok).toBe(true);
    expect(summary.eligibleCount).toBe(0);
    expect(summary.deletedCount).toBe(0);
  });

  it("is idempotent — a second run against an already-purged household is a no-op", async () => {
    const db = freshDb();
    const oldEnough = new Date(
      NOW.getTime() - (HOUSEHOLD_PURGE_RETENTION_DAYS + 5) * DAY_MS,
    ).toISOString();
    db.households.push({ id: "h-old", disbanded_at: oldEnough });
    db.household_members.push({ id: "m-1", household_id: "h-old" });

    const supabase = makeFakeSupabase(db);

    const first = await runHouseholdPurge(supabase, NOW);
    expect(first.deletedCount).toBe(1);

    const second = await runHouseholdPurge(supabase, NOW);
    expect(second.ok).toBe(true);
    expect(second.deletedCount).toBe(0);
    expect(second.eligibleCount).toBe(0);
  });

  it("only deletes households exactly at the 30-day boundary or older", async () => {
    const db = freshDb();
    const exactlyAtCutoff = new Date(
      NOW.getTime() - HOUSEHOLD_PURGE_RETENTION_DAYS * DAY_MS,
    ).toISOString();
    db.households.push({ id: "h-boundary", disbanded_at: exactlyAtCutoff });

    const supabase = makeFakeSupabase(db);
    const summary = await runHouseholdPurge(supabase, NOW);

    expect(summary.deletedCount).toBe(1);
  });
});

describe("runHouseholdPurgeRoute — auth + config gates", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, ORIGINAL_ENV);
    delete process.env.SUPPR_CRON_SECRET;
  });

  function buildReq(headers: Record<string, string> = {}): Request {
    return new Request("https://example.com/api/cron/household-purge", {
      method: "POST",
      headers,
    });
  }

  it("503 when SUPPR_CRON_SECRET is unset", async () => {
    const res = await runHouseholdPurgeRoute(buildReq(), () => null);
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toBe("server_misconfigured");
    expect(json.message).toMatch(/SUPPR_CRON_SECRET/);
  });

  it("401 when secret is wrong", async () => {
    process.env.SUPPR_CRON_SECRET = "expected-secret";
    const res = await runHouseholdPurgeRoute(
      buildReq({ "x-cron-secret": "wrong" }),
      () => null,
    );
    expect(res.status).toBe(401);
  });

  it("503 when service-role client is unavailable", async () => {
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    const res = await runHouseholdPurgeRoute(
      buildReq({ "x-cron-secret": "ok-secret" }),
      () => null,
    );
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("200 with summary on happy path", async () => {
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    const db = freshDb();
    const fakeSupabase = makeFakeSupabase(db);
    const res = await runHouseholdPurgeRoute(
      buildReq({ "x-cron-secret": "ok-secret" }),
      () => fakeSupabase,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.deletedCount).toBe(0);
  });

  it("502 when the runner throws", async () => {
    process.env.SUPPR_CRON_SECRET = "ok-secret";
    const throwingRunner = vi.fn().mockRejectedValue(new Error("db exploded"));
    const res = await runHouseholdPurgeRoute(
      buildReq({ "x-cron-secret": "ok-secret" }),
      () => ({}) as any,
      throwingRunner,
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("purge_failed");
    expect(json.message).toMatch(/db exploded/);
  });
});

describe("safeCompare", () => {
  it("returns true only for exact matches", () => {
    expect(safeCompare("abc", "abc")).toBe(true);
    expect(safeCompare("abc", "abd")).toBe(false);
    expect(safeCompare("abc", "ab")).toBe(false);
    expect(safeCompare("", "")).toBe(true);
  });
});
