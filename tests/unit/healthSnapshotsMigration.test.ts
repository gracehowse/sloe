/**
 * Structural pin for the `health_snapshots` migration (D4).
 *
 * The Apple Health card on web reads this table and the iOS app
 * writes it. RLS MUST restrict reads/writes to the owning user —
 * another user snapshot must never leak through. This test pins the
 * migration file so a future refactor cannot silently drop the
 * policies or regress the index that backs the latest-row lookup.
 *
 * We assert structure, not runtime behaviour — the remote Postgres
 * is exercised by Supabase's own CI and by `supabase db push --linked`
 * locally.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = readFileSync(
  join(process.cwd(), "supabase/migrations/20260429100000_health_snapshots.sql"),
  "utf8",
);

describe("20260429100000_health_snapshots migration", () => {
  it("creates the health_snapshots table with the documented columns", () => {
    expect(MIGRATION).toMatch(/create table if not exists public\.health_snapshots/);
    expect(MIGRATION).toMatch(/user_id uuid not null references auth\.users\(id\) on delete cascade/);
    expect(MIGRATION).toMatch(/captured_at timestamptz not null default now\(\)/);
    expect(MIGRATION).toMatch(/steps integer/);
    expect(MIGRATION).toMatch(/active_energy_kcal integer/);
    expect(MIGRATION).toMatch(/resting_burn_kcal integer/);
    expect(MIGRATION).toMatch(/weight_kg numeric\(6, 2\)/);
    expect(MIGRATION).toMatch(/source text not null default 'healthkit'/);
    expect(MIGRATION).toMatch(/device_id text/);
  });

  it("creates the (user_id, captured_at desc) index the web reader relies on", () => {
    expect(MIGRATION).toMatch(
      /create index if not exists health_snapshots_user_captured_desc_idx[\s\S]*?\(user_id, captured_at desc\)/,
    );
  });

  it("enables RLS and defines owner-scoped select + insert policies", () => {
    expect(MIGRATION).toMatch(/alter table public\.health_snapshots enable row level security/);
    // Owner SELECT — another user must not be able to read these rows.
    expect(MIGRATION).toMatch(/create policy "health_snapshots_owner_select"[\s\S]*?using \(auth\.uid\(\) = user_id\)/);
    // Owner INSERT — users can only write rows for themselves.
    expect(MIGRATION).toMatch(/create policy "health_snapshots_owner_insert"[\s\S]*?with check \(auth\.uid\(\) = user_id\)/);
  });

  it("does NOT expose UPDATE or DELETE policies — snapshots are immutable from the client", () => {
    // If these regex ever match, we've accidentally opened a surface
    // the design brief explicitly forbids.
    expect(MIGRATION).not.toMatch(/create policy[^\n]*\n\s+on public\.health_snapshots\n\s+for update/);
    expect(MIGRATION).not.toMatch(/create policy[^\n]*\n\s+on public\.health_snapshots\n\s+for delete/);
  });
});
