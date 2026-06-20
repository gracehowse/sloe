/**
 * Structural pin for the `nutrition_entry_ingredients` migration (ENG-751).
 *
 * This child table persists the per-item AI/photo/voice meal breakdown. RLS MUST
 * scope reads/writes to the user who owns the PARENT `nutrition_entries` row —
 * another user's snapshot must never leak. This test pins the migration so a
 * future refactor cannot silently drop the parent-derived ownership policies,
 * open an UPDATE/DELETE surface (snapshots are immutable), or regress the
 * `entry_id` FK + cascade or the read index.
 *
 * We assert structure, not runtime behaviour — the remote Postgres is exercised
 * by `supabase db push --linked` + Supabase's own CI.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260620120100_eng751_nutrition_entry_ingredients.sql",
  ),
  "utf8",
);

describe("20260620120100_eng751_nutrition_entry_ingredients migration", () => {
  it("creates the table with the documented columns + precision", () => {
    expect(MIGRATION).toMatch(
      /create table if not exists public\.nutrition_entry_ingredients/,
    );
    // Macros are numeric (full AI fidelity), matching the user_saved_meal_items
    // precedent — NOT the rounded smallint/real of nutrition_entries.
    expect(MIGRATION).toMatch(/calories\s+numeric/);
    expect(MIGRATION).toMatch(/protein\s+numeric/);
    expect(MIGRATION).toMatch(/carbs\s+numeric/);
    expect(MIGRATION).toMatch(/fat\s+numeric/);
    expect(MIGRATION).toMatch(/fiber_g\s+numeric/);
    expect(MIGRATION).toMatch(/confidence\s+numeric/);
    expect(MIGRATION).toMatch(/source\s+text/);
    expect(MIGRATION).toMatch(/name\s+text not null/);
    expect(MIGRATION).toMatch(/created_at\s+timestamptz not null default now\(\)/);
  });

  it("FKs entry_id to nutrition_entries with ON DELETE CASCADE", () => {
    expect(MIGRATION).toMatch(
      /entry_id\s+uuid not null references public\.nutrition_entries\(id\) on delete cascade/,
    );
  });

  it("constrains confidence to [0,1] and macros to non-negative", () => {
    expect(MIGRATION).toMatch(
      /confidence\s+numeric check \(confidence is null or \(confidence >= 0 and confidence <= 1\)\)/,
    );
    expect(MIGRATION).toMatch(/calories\s+numeric check \(calories is null or calories >= 0\)/);
  });

  it("indexes the entry_id lookup the read path relies on", () => {
    expect(MIGRATION).toMatch(
      /create index if not exists nutrition_entry_ingredients_entry_idx[\s\S]*?\(entry_id\)/,
    );
  });

  it("enables RLS and derives owner ownership via the parent entry's user_id", () => {
    expect(MIGRATION).toMatch(
      /alter table public\.nutrition_entry_ingredients enable row level security/,
    );
    // Owner SELECT — exists() against the parent nutrition_entries row.
    expect(MIGRATION).toMatch(
      /create policy "nutrition_entry_ingredients_owner_select"[\s\S]*?for select[\s\S]*?exists \([\s\S]*?from public\.nutrition_entries e[\s\S]*?e\.user_id = \(select auth\.uid\(\)\)/,
    );
    // Owner INSERT — same parent-derived ownership in the WITH CHECK.
    expect(MIGRATION).toMatch(
      /create policy "nutrition_entry_ingredients_owner_insert"[\s\S]*?for insert[\s\S]*?with check \([\s\S]*?from public\.nutrition_entries e[\s\S]*?e\.user_id = \(select auth\.uid\(\)\)/,
    );
  });

  it("does NOT expose UPDATE or DELETE policies — snapshots are immutable", () => {
    expect(MIGRATION).not.toMatch(
      /create policy[^\n]*\n\s+on public\.nutrition_entry_ingredients for update/,
    );
    expect(MIGRATION).not.toMatch(
      /create policy[^\n]*\n\s+on public\.nutrition_entry_ingredients for delete/,
    );
  });
});
