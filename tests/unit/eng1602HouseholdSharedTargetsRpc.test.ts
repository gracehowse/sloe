import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ENG-1602 — `get_household_shared_targets` SECURITY DEFINER RPC.
 *
 * There is no live DB in CI (the migration-apply rule forbids `db push`
 * here — Grace runs `supabase db push --linked`), so this file pins the
 * migration SOURCE the way `eng1307RpcExecuteLockdown.test.ts` /
 * `eng1389DbGrantHardening.test.ts` do for their RPCs: a refactor can't
 * silently loosen the co-membership/consent re-check, widen the exposed
 * columns, or re-grant anon.
 *
 * Root-cause recap: `profiles` / `nutrition_entries` SELECT RLS is
 * strictly self-only with no household carve-out, so a direct
 * cross-member read from the client silently returns zero rows (no
 * error) in production. This RPC is the one deliberate, narrow exception
 * to "household code never reads those tables" — it re-checks
 * co-membership + `share_targets = true` itself and returns only
 * derived numbers, never a raw row or any other column.
 */

const MIGRATION_PATH =
  "supabase/migrations/20260721100000_eng1602_household_shared_targets_rpc.sql";

const SQL = readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf-8");

// Executable SQL only — `--` line comments stripped, whitespace
// normalised, lowercased, so prose in the header can't satisfy (or trip)
// a statement assertion.
const CODE = SQL.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

// The original "is timestamped after every currently-committed migration"
// check here asserted this migration was the newest file in the directory
// at test-run time — an inherently non-durable invariant that breaks on
// every subsequent migration added by ANY later PR (not a defect in
// theirs, or in this one; see ENG-1630, filed 2026-07-21, for the general
// "ratchet/snapshot assertions go stale under this repo's concurrent-agent
// editing" pattern this is an instance of). Removed 2026-07-21 by the
// ENG-1490 migration that legitimately postdates it — there is no real
// ordering dependency between the two (unrelated tables, unrelated RPCs).

describe("ENG-1602 get_household_shared_targets — definer + search_path", () => {
  it("is SECURITY DEFINER with a pinned search_path (no mutable-search_path advisor hit)", () => {
    expect(CODE).toMatch(
      /create or replace function public\.get_household_shared_targets\(\) returns table \(/,
    );
    expect(CODE).toContain("language plpgsql security definer set search_path = public, pg_temp");
  });

  it("returns not authenticated as an empty set, never an error that could leak info", () => {
    expect(CODE).toMatch(/if v_uid is null then return;/);
  });
});

describe("ENG-1602 get_household_shared_targets — co-membership + consent re-check", () => {
  it("resolves the caller's household from the caller's OWN household_members row only", () => {
    // The function takes no arguments at all — nothing client-suppliable
    // to spoof, household or otherwise.
    expect(CODE).toContain("create or replace function public.get_household_shared_targets()");
    expect(CODE).toMatch(
      /select hm\.household_id into v_household_id from public\.household_members hm where hm\.user_id = v_uid order by hm\.joined_at desc limit 1;/,
    );
  });

  it("returns an empty set when the caller is not in a household", () => {
    expect(CODE).toMatch(/if v_household_id is null then return;/);
  });

  it("re-checks share_targets = true server-side for every returned row", () => {
    expect(CODE).toMatch(/hm\.share_targets = true/);
  });

  it("excludes the caller from their own co-member result set", () => {
    expect(CODE).toMatch(/hm\.user_id <> v_uid/);
  });

  it("scopes the co-member join to the CALLER's resolved household, not any client-supplied id", () => {
    expect(CODE).toMatch(/hm\.household_id = v_household_id/);
  });
});

describe("ENG-1602 get_household_shared_targets — narrow output contract", () => {
  it("return table exposes ONLY the nine approved columns", () => {
    const match = SQL.match(/returns table \(([\s\S]*?)\)\s*\n?language/i);
    expect(match).not.toBeNull();
    const columns = match![1]
      .split(",")
      .map((c) => c.trim().split(/\s+/)[0])
      .filter(Boolean);
    expect(columns).toEqual([
      "user_id",
      "target_calories",
      "target_protein",
      "target_carbs",
      "target_fat",
      "consumed_calories",
      "consumed_protein",
      "consumed_carbs",
      "consumed_fat",
    ]);
  });

  it("never selects display_name, email, or any other PII column off profiles", () => {
    for (const forbidden of ["display_name", "email", "weight", "household_id", "created_at", "updated_at"]) {
      expect(
        CODE.includes(`p.${forbidden}`),
        `function body selects public.profiles.${forbidden} -- only target_* columns are approved`,
      ).toBe(false);
    }
  });

  it("never returns a raw nutrition_entries row -- consumed_* are aggregated sums only", () => {
    expect(CODE).toMatch(/coalesce\(sum\(ne\.calories\), 0\)::numeric as consumed_calories/);
    expect(CODE).toMatch(/coalesce\(sum\(ne\.protein\), 0\)::numeric as consumed_protein/);
    expect(CODE).toMatch(/coalesce\(sum\(ne\.carbs\), 0\)::numeric as consumed_carbs/);
    expect(CODE).toMatch(/coalesce\(sum\(ne\.fat\), 0\)::numeric as consumed_fat/);
    // No `select ne.*` / `select *` anywhere touching nutrition_entries.
    expect(CODE).not.toMatch(/select\s+ne\.\*/);
    expect(CODE).not.toMatch(/select\s+\*\s+from\s+public\.nutrition_entries/);
  });

  it("scopes consumed-today to EACH co-member's OWN local date via profiles.tz_iana, never the caller's date applied to everyone", () => {
    // The bug an adversarial review caught before this shipped: a first
    // draft took a client-supplied p_date_key and applied that SAME date
    // to every co-member's nutrition_entries filter -- wrong for a
    // cross-timezone household, since date_key is always the LOGGING
    // user's own local day. Fixed by resolving each row's date server-side
    // from that row's own profiles.tz_iana (coalesced to UTC), matching
    // the weekly-recap cron's established null-handling precedent.
    expect(CODE).toMatch(
      /ne\.date_key = \(current_timestamp at time zone coalesce\(p\.tz_iana, 'utc'\)\)::date/,
    );
    // No client-suppliable date argument exists at all anymore.
    expect(CODE).not.toMatch(/p_date_key/);
    expect(CODE).not.toMatch(/get_household_shared_targets\([^)]+\)/);
  });
});

describe("ENG-1602 get_household_shared_targets — grant lockdown", () => {
  it("grants execute to authenticated only", () => {
    expect(CODE).toContain(
      "grant execute on function public.get_household_shared_targets() to authenticated;",
    );
  });

  it("revokes from public and never grants to anon", () => {
    expect(CODE).toContain("revoke all on function public.get_household_shared_targets() from public;");
    expect(CODE).not.toMatch(/grant[^;]*get_household_shared_targets[^;]*anon/);
  });
});

describe("ENG-1602 get_household_shared_targets — migration hygiene", () => {
  it("reloads the PostgREST schema cache so the RPC is callable without a manual restart", () => {
    expect(CODE).toContain("notify pgrst, 'reload schema';");
  });
});

describe("ENG-1602 household privacy boundary — the RPC is the sole documented exception", () => {
  it("the household privacy RLS pin test carves out exactly this migration by name, and only this one", () => {
    const pinTest = readFileSync(
      resolve(process.cwd(), "tests/unit/householdPrivacyRls.test.ts"),
      "utf-8",
    );
    expect(pinTest).toContain(
      "20260721100000_eng1602_household_shared_targets_rpc.sql",
    );
  });
});
