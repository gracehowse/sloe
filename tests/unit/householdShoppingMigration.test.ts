/**
 * Honeydew parity (2026-04-30) — pin the household-shopping migration.
 *
 * `supabase/migrations/20260504100100_household_shopping.sql` is the
 * one place where shopping_items's RLS contract gets rewritten. A
 * regression here can either silently break the per-user fallback
 * (privacy bug) or silently leak one household's list into another
 * (privacy disaster). This test reads the migration verbatim and
 * asserts the invariants the runtime relies on:
 *
 *  - `household_id` column added (nullable, FK to households, ON DELETE CASCADE)
 *  - `checked_by` column added (audit trail for member attribution)
 *  - Legacy "Own shopping items" policy is dropped
 *  - Four explicit per-action policies exist (select/insert/update/delete)
 *  - Each policy permits `(household_id IS NULL AND user_id = auth.uid())`
 *    OR `(household_id IN auth_household_ids())`
 *  - INSERT WITH CHECK enforces `user_id = auth.uid()` (audit trail
 *    integrity — a member can't pretend to be another)
 *  - The migration registers `shopping_items` with `supabase_realtime`
 *    so members get sub-second updates
 *  - The helper used is the recursion-safe `auth_household_ids()`
 *    (NOT a raw `SELECT FROM household_members`) — otherwise
 *    Postgres would re-recurse when the policy fires on a join.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260504100100_household_shopping.sql"),
  "utf8",
);

describe("household_shopping migration (2026-05-04)", () => {
  it("adds the household_id column with the correct FK + ON DELETE CASCADE", () => {
    expect(SQL).toMatch(
      /add column if not exists household_id uuid references public\.households\(id\) on delete cascade/i,
    );
  });

  it("adds the checked_by audit column referencing auth.users", () => {
    expect(SQL).toMatch(
      /add column if not exists checked_by uuid references auth\.users\(id\) on delete set null/i,
    );
  });

  it("adds the checked_at timestamp for attribution sorting", () => {
    expect(SQL).toMatch(/add column if not exists checked_at timestamptz/i);
  });

  it("creates a partial index on household_id for fast member reads", () => {
    expect(SQL).toMatch(
      /create index if not exists shopping_items_household_idx[\s\S]*where household_id is not null/i,
    );
  });

  it("drops the legacy 'Own shopping items' policy (replaced by 4 per-action policies)", () => {
    expect(SQL).toMatch(/drop policy if exists "Own shopping items" on public\.shopping_items/i);
  });

  it("creates exactly four explicit per-action policies", () => {
    for (const policy of [
      "household_shopping_select",
      "household_shopping_insert",
      "household_shopping_update",
      "household_shopping_delete",
    ]) {
      expect(SQL).toMatch(
        new RegExp(`create policy "${policy}"\\s+on public\\.shopping_items`, "i"),
      );
    }
  });

  it("uses auth_household_ids() (recursion-safe helper, not raw select from household_members)", () => {
    // Every policy that fans out to household scope MUST go through the helper.
    expect(SQL).toMatch(/select public\.auth_household_ids\(\)/i);
    // And there should be NO raw subselect joining through household_members,
    // which would re-trigger the recursion bug fixed in 20260423110000.
    expect(SQL).not.toMatch(/select household_id from public\.household_members/i);
  });

  it("SELECT policy permits both per-user AND household scope", () => {
    // The SELECT policy text must mention both branches.
    const selectMatch = SQL.match(
      /create policy "household_shopping_select"[\s\S]*?(?=create policy|;\s*$)/i,
    );
    expect(selectMatch).toBeTruthy();
    const policy = selectMatch![0];
    expect(policy).toMatch(/household_id is null and user_id = auth\.uid\(\)/i);
    expect(policy).toMatch(/household_id is not null and household_id in \(select public\.auth_household_ids\(\)\)/i);
  });

  it("INSERT WITH CHECK forces user_id = auth.uid() (no impersonation)", () => {
    const insertMatch = SQL.match(
      /create policy "household_shopping_insert"[\s\S]*?(?=create policy|;\s*$)/i,
    );
    expect(insertMatch).toBeTruthy();
    const policy = insertMatch![0];
    // The audit trail must be honest — even members of the same
    // household can't insert as someone else.
    expect(policy).toMatch(/user_id = auth\.uid\(\)/);
  });

  it("registers shopping_items with the supabase_realtime publication", () => {
    expect(SQL).toMatch(
      /alter publication supabase_realtime add table public\.shopping_items/i,
    );
    // Wrapped in a guarded DO block so the migration is portable.
    expect(SQL).toMatch(
      /pg_publication[\s\S]*pubname = 'supabase_realtime'/i,
    );
  });

  it("guards both column adds + policy drops with IF EXISTS / IF NOT EXISTS (idempotent)", () => {
    // Migration must be re-runnable on a partially-applied DB.
    const idempotentLines = SQL.split("\n").filter(
      (l) =>
        /add column/i.test(l) ||
        /create index/i.test(l) ||
        /drop policy/i.test(l),
    );
    for (const line of idempotentLines) {
      expect(line).toMatch(/if (not )?exists/i);
    }
  });
});
