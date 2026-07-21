/**
 * Netflix-model v1 (2026-05-01) — privacy boundary pin.
 *
 * Household spec §3: a household sees what's on the table, not what's
 * on the scale. Personal macros, weight, body metrics, streaks, and
 * health data must never be inferable through household relations.
 *
 * This test scans every household migration and asserts that:
 *  1. No household migration adds a policy to a table holding personal
 *     data (profiles, weight_entries, nutrition_entries, health_snapshots,
 *     daily_targets, body_measurements, user_activity, …).
 *  2. No household RLS predicate references those tables in a way
 *     that would let a household member read another member's row.
 *  3. The household_* tables themselves do not store personal macro /
 *     weight / health columns — the only nutrition columns on
 *     household_meals are PER-SERVING (recipe metadata, not user state).
 *
 * Runtime RLS is exercised by Supabase's own tests and the integration
 * suite. This is the migration-level belt-and-braces, per spec §6.6.
 *
 * ENG-1602 (2026-07-21) exception: `get_household_shared_targets`
 * (20260721100000) is a SECURITY DEFINER RPC — deliberately, not an RLS
 * policy — that reads `profiles`/`nutrition_entries` to serve the H4
 * `share_targets` opt-in for real. The opt-in was previously a silent
 * no-op: those tables' SELECT RLS is self-only, so a direct cross-member
 * read returned nothing and the client papered over it with fabricated
 * numbers (see the migration's own header for the full root-cause
 * writeup). This does NOT weaken invariants (1) or (2) above — no RLS
 * policy is added, and every returned row re-checks co-membership +
 * `share_targets = true` inside the definer boundary — but it DOES read
 * from those two tables by design, which the blanket "no household
 * migration ever reads from these tables" regex scan below cannot tell
 * apart from a leak. That one migration is excluded from the two
 * leak-pattern checks and instead gets its own dedicated safety-property
 * suite: `tests/unit/eng1602HouseholdSharedTargetsRpc.test.ts`. Keep this
 * exclusion list to exactly that one entry — growing it casually is how
 * the privacy boundary erodes.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

const DELIBERATE_CROSS_MEMBER_READ_EXCEPTIONS = new Set([
  "20260721100000_eng1602_household_shared_targets_rpc.sql",
]);

function householdMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.startsWith("2026") && f.includes("household"))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8"),
    }));
}

// Tables that hold per-user state the household must never expose.
// Any household_* migration that adds a policy to one of these (or
// even references it in a USING/WITH CHECK clause through a cross-join)
// is a privacy regression.
const FORBIDDEN_TABLES = [
  "profiles",
  "weight_entries",
  "body_measurements",
  "nutrition_entries",
  "health_snapshots",
  "daily_targets",
  "user_activity",
  "streak",
  "adaptive_tdee",
  "user_foods",
];

describe("Household RLS privacy boundary", () => {
  it("finds household migrations to scan", () => {
    const migs = householdMigrations();
    expect(migs.length).toBeGreaterThan(0);
    expect(migs.map((m) => m.name)).toContain(
      "20260420100000_household_planning.sql",
    );
  });

  it("no household migration creates a policy on a personal-data table", () => {
    for (const { name, sql } of householdMigrations()) {
      for (const table of FORBIDDEN_TABLES) {
        // Match `create policy "..." on public.<table>` or `on <table>`
        const policyPattern = new RegExp(
          `create\\s+policy[^;]+?on\\s+(public\\.)?${table}\\b`,
          "is",
        );
        expect(policyPattern.test(sql), `${name} adds a policy to ${table}`).toBe(
          false,
        );
      }
    }
  });

  it("no household RLS predicate joins through profiles / weight / nutrition state", () => {
    for (const { name, sql } of householdMigrations()) {
      // ENG-1602: the one deliberate, reviewed exception — see the file
      // header. This is a SECURITY DEFINER RPC read, not an RLS
      // predicate, and is covered by its own dedicated safety-property
      // test suite instead.
      if (DELIBERATE_CROSS_MEMBER_READ_EXCEPTIONS.has(name)) continue;
      // A household policy clause referencing e.g. `profiles.weight_kg`
      // or selecting from profiles inside a USING/WITH CHECK would be a
      // leakage vector. We allow a single known benign case: the
      // `profiles.household_id` FK column is a back-pointer, not a
      // cross-member read. Reject everything else.
      const leaks = [
        /from\s+public\.profiles/i,
        /from\s+profiles\b/i,
        /from\s+public\.weight_entries/i,
        /from\s+public\.nutrition_entries/i,
        /from\s+public\.health_snapshots/i,
        /from\s+public\.daily_targets/i,
      ];
      for (const re of leaks) {
        expect(re.test(sql), `${name} reads from a personal-data table: ${re}`).toBe(
          false,
        );
      }
    }
  });

  it("household_meals carries per-serving nutrition only — not per-user macros", () => {
    const planning = readFileSync(
      join(MIGRATIONS_DIR, "20260420100000_household_planning.sql"),
      "utf8",
    );
    // Per-serving columns are OK (recipe metadata, shared by design).
    expect(planning).toMatch(/calories_per_serving/);
    expect(planning).toMatch(/protein_per_serving/);
    // Columns that would imply per-user state must not appear on
    // household_meals.
    const table = planning.match(
      /create table if not exists public\.household_meals[\s\S]*?\);/i,
    );
    expect(table).not.toBeNull();
    const tableSql = table![0];
    expect(tableSql).not.toMatch(/target_calories/);
    expect(tableSql).not.toMatch(/weight_kg/);
    expect(tableSql).not.toMatch(/streak/);
    expect(tableSql).not.toMatch(/adaptive_tdee/);
  });

  it("household_members row does NOT store member macros / weight / targets", () => {
    const planning = readFileSync(
      join(MIGRATIONS_DIR, "20260420100000_household_planning.sql"),
      "utf8",
    );
    const table = planning.match(
      /create table if not exists public\.household_members[\s\S]*?\);/i,
    );
    expect(table).not.toBeNull();
    const tableSql = table![0];
    for (const col of [
      "target_calories",
      "target_protein",
      "target_carbs",
      "target_fat",
      "weight_kg",
      "goal_weight_kg",
      "streak",
      "adaptive_tdee",
    ]) {
      expect(tableSql, `household_members.${col} would leak personal state`).not.toMatch(
        new RegExp(col, "i"),
      );
    }
  });
});
