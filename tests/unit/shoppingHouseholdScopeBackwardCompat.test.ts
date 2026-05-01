/**
 * Honeydew parity (2026-04-30) — backward-compat invariants.
 *
 * Existing pre-2026-05 shopping_items rows have `household_id = null`
 * and `checked_by = null`. We must NOT silently re-attribute or
 * re-scope them when a user joins a household — they belong to the
 * caller alone forever.
 *
 * Conversely, when the user is in a household we must NOT mix their
 * legacy per-user rows into the shared list (which would confuse a
 * member who joined yesterday with stale items from last month).
 *
 * Both invariants are pinned by the helper rules — this test is an
 * extra layer that exercises the migration timing and the read
 * filters together.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  shoppingScopeFor,
  shoppingScopeReadFilters,
  shoppingScopeInsertStamp,
} from "@/lib/household/shoppingScope";

describe("shopping scope backward compatibility", () => {
  it("solo user joining a household does NOT pull their pre-existing rows", () => {
    // Pre-join: solo scope reads user_id + household_id IS NULL.
    const beforeJoin = shoppingScopeFor({ userId: "u1", householdId: null });
    const beforeFilters = shoppingScopeReadFilters(beforeJoin);
    expect(beforeFilters).toEqual([
      ["user_id", "eq", "u1"],
      ["household_id", "is", null],
    ]);

    // Post-join: household scope reads household_id only. The legacy
    // rows (with `household_id = null`) are NOT in this scope, so the
    // user's old solo list is invisible to the new household — and the
    // household never sees them. Deliberate: prevents stale "I bought
    // milk last month" items from polluting a fresh shared list.
    const afterJoin = shoppingScopeFor({ userId: "u1", householdId: "h1" });
    const afterFilters = shoppingScopeReadFilters(afterJoin);
    expect(afterFilters).toEqual([["household_id", "eq", "h1"]]);
  });

  it("solo user inserts always carry household_id = null", () => {
    const stamp = shoppingScopeInsertStamp(
      shoppingScopeFor({ userId: "u1", householdId: null }),
    );
    expect(stamp.household_id).toBeNull();
    expect(stamp.user_id).toBe("u1");
  });

  it("household user inserts always carry household_id (NOT null) AND user_id (audit)", () => {
    const stamp = shoppingScopeInsertStamp(
      shoppingScopeFor({ userId: "u-bob", householdId: "h-2" }),
    );
    expect(stamp.household_id).toBe("h-2");
    // user_id MUST still be set — RLS WITH CHECK on insert requires
    // it, plus the audit trail uses it for "who added this" UI.
    expect(stamp.user_id).toBe("u-bob");
  });

  it("migration is forward-compat with pre-existing rows (no data migration)", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260504100100_household_shopping.sql"),
      "utf8",
    );
    // No UPDATE, no INSERT, no DELETE statements that would touch
    // existing data. The migration is purely additive: column adds +
    // policy rewrites + index. Pre-existing rows stay exactly where
    // they are.
    const lower = sql.toLowerCase();
    expect(lower).not.toMatch(/^\s*update public\.shopping_items/m);
    expect(lower).not.toMatch(/^\s*insert into public\.shopping_items/m);
    expect(lower).not.toMatch(/^\s*delete from public\.shopping_items/m);
  });
});
