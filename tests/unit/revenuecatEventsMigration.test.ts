import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** T6 (full-sweep 2026-04-24) — pin the revenuecat_events migration
 *  shape so the dedup contract matches stripe_webhook_events (T23)
 *  and a future refactor can't silently regress. */

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260503100800_revenuecat_events.sql"),
  "utf-8",
);

describe("revenuecat_events migration shape", () => {
  it("creates the table with event_id as primary key", () => {
    expect(SQL).toMatch(
      /create table if not exists public\.revenuecat_events\s*\([\s\S]*?event_id text primary key/i,
    );
  });

  it("captures event_type / app_user_id / user_id / payload / received_at", () => {
    expect(SQL).toMatch(/event_type text not null/i);
    expect(SQL).toMatch(/app_user_id text not null/i);
    // user_id is nullable on purpose — RC events for anonymous users
    // are still persisted for audit but don't have a Supabase mapping.
    expect(SQL).toMatch(/user_id uuid(?!\s+not null)/i);
    expect(SQL).toMatch(/payload jsonb not null/i);
    expect(SQL).toMatch(/received_at timestamptz not null default now\(\)/i);
  });

  it("partial-indexes user_id (only mapped events)", () => {
    expect(SQL).toMatch(
      /create index if not exists revenuecat_events_user_id_idx[\s\S]*?on public\.revenuecat_events \(user_id\) where user_id is not null/i,
    );
  });

  it("indexes received_at for retention pruning", () => {
    expect(SQL).toMatch(
      /create index if not exists revenuecat_events_received_at_idx[\s\S]*?on public\.revenuecat_events \(received_at\)/i,
    );
  });

  it("enables RLS with NO public policies (service-role only)", () => {
    expect(SQL).toMatch(
      /alter table public\.revenuecat_events enable row level security/i,
    );
    const policyCount = (SQL.match(/create policy/gi) ?? []).length;
    expect(policyCount).toBe(0);
  });
});
