import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
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

describe("ENG-1602 get_household_shared_targets — filename + migration ordering", () => {
  it("is timestamped after every currently-committed migration", () => {
    const dir = resolve(process.cwd(), "supabase/migrations");
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".sql"));
    const thisVersion = "20260721100000";
    for (const f of files) {
      const m = f.match(/^(\d{14})_/);
      if (!m) continue;
      if (f === "20260721100000_eng1602_household_shared_targets_rpc.sql") continue;
      expect(
        m[1] <= thisVersion,
        `${f} (${m[1]}) is not monotonically before this migration (${thisVersion})`,
      ).toBe(true);
    }
  });
});

describe("ENG-1602 get_household_shared_targets — definer + search_path", () => {
  it("is SECURITY DEFINER with a pinned search_path (no mutable-search_path advisor hit)", () => {
    expect(CODE).toMatch(
      /create or replace function public\.get_household_shared_targets\( p_date_key date default current_date \) returns table \(/,
    );
    expect(CODE).toContain("language plpgsql security definer set search_path = public, pg_temp");
  });

  it("returns not authenticated as an empty set, never an error that could leak info", () => {
    expect(CODE).toMatch(/if v_uid is null then return;/);
  });
});

describe("ENG-1602 get_household_shared_targets — co-membership + consent re-check", () => {
  it("resolves the caller's household from the caller's OWN household_members row only", () => {
    // No household id is ever taken as an argument — the function
    // signature above has exactly one parameter, p_date_key.
    expect(CODE).not.toMatch(/get_household_shared_targets\([^)]*household_id/);
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

  it("scopes consumed-today to the caller-supplied date_key, never a bare current_date read inside the body", () => {
    expect(CODE).toMatch(/ne\.date_key = p_date_key/);
    // The ONLY place `current_date` may appear is the parameter default
    // -- never re-read inside the function body/query itself.
    const occurrences = CODE.match(/current_date/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});

describe("ENG-1602 get_household_shared_targets — grant lockdown", () => {
  it("grants execute to authenticated only", () => {
    expect(CODE).toContain(
      "grant execute on function public.get_household_shared_targets(date) to authenticated;",
    );
  });

  it("revokes from public and never grants to anon", () => {
    expect(CODE).toContain("revoke all on function public.get_household_shared_targets(date) from public;");
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
