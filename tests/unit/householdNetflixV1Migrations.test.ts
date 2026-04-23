/**
 * Netflix-model v1 (2026-05-01) — structural pins for the 3 new
 * household migrations. Asserts the documented column set, defaults,
 * and check constraints so a future edit can't silently drop them.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(name: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");
}

describe("20260501100000_household_share_preset", () => {
  const SQL = read("20260501100000_household_share_preset.sql");

  it("adds share_preset column to household_members with 'dinners' default", () => {
    expect(SQL).toMatch(
      /alter table public\.household_members[\s\S]*?add column if not exists share_preset text not null default 'dinners'/i,
    );
  });

  it("enforces the five-value check constraint", () => {
    expect(SQL).toMatch(/share_preset in\s*\(\s*'all',\s*'dinners',\s*'dinners_weekends',\s*'lunch_dinner',\s*'custom'\s*\)/i);
  });

  it("backfills share_lunch=true households to lunch_dinner preset", () => {
    expect(SQL).toMatch(/update public\.household_members/i);
    expect(SQL).toMatch(/set share_preset = 'lunch_dinner'/i);
    expect(SQL).toMatch(/share_lunch = true/i);
  });

  it("creates the (household_id, share_preset) index", () => {
    expect(SQL).toMatch(
      /create index if not exists idx_household_members_preset[\s\S]*?\(household_id, share_preset\)/i,
    );
  });
});

describe("20260501100010_households_disbanded_at", () => {
  const SQL = read("20260501100010_households_disbanded_at.sql");

  it("adds disbanded_at timestamptz to households", () => {
    expect(SQL).toMatch(
      /alter table public\.households[\s\S]*?add column if not exists disbanded_at timestamptz/i,
    );
  });

  it("indexes disbanded_at with a partial predicate", () => {
    expect(SQL).toMatch(
      /create index if not exists idx_households_disbanded[\s\S]*?where disbanded_at is not null/i,
    );
  });
});

describe("20260501100020_household_meals_cook_display_name", () => {
  const SQL = read("20260501100020_household_meals_cook_display_name.sql");

  it("adds cook_display_name text to household_meals", () => {
    expect(SQL).toMatch(
      /alter table public\.household_meals[\s\S]*?add column if not exists cook_display_name text/i,
    );
  });

  it("backfills cook_display_name from current membership rows", () => {
    expect(SQL).toMatch(/update public\.household_meals/i);
    expect(SQL).toMatch(/from public\.household_members/i);
    expect(SQL).toMatch(/hm\.added_by = m\.user_id/i);
  });
});
