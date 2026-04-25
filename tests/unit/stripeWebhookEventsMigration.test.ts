import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * T23 (full-sweep 2026-04-24) — pin the stripe_webhook_events table
 * shape so the dedup primitive doesn't silently regress (the same
 * primitive will back T6's RevenueCat webhook).
 */

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260503100700_stripe_webhook_events.sql"),
  "utf-8",
);

describe("stripe_webhook_events migration shape", () => {
  it("creates the table with event_id as primary key", () => {
    expect(SQL).toMatch(
      /create table if not exists public\.stripe_webhook_events\s*\([\s\S]*?event_id text primary key/i,
    );
  });

  it("stores received_at with default now()", () => {
    expect(SQL).toMatch(/received_at timestamptz not null default now\(\)/i);
  });

  it("indexes received_at for retention pruning", () => {
    expect(SQL).toMatch(
      /create index if not exists stripe_webhook_events_received_at_idx[\s\S]*?on public\.stripe_webhook_events\s*\(received_at\)/i,
    );
  });

  it("enables RLS with NO public policies (service-role only)", () => {
    expect(SQL).toMatch(/alter table public\.stripe_webhook_events enable row level security/i);
    // Authenticated / anon must not be able to probe processed events.
    // Pinning the absence of CREATE POLICY in this migration so a
    // future refactor can't quietly add one without updating this test.
    const policyCount = (SQL.match(/create policy/gi) ?? []).length;
    expect(policyCount).toBe(0);
  });
});

describe("webhookProcess.ts uses the table for dedup (T23)", () => {
  const TS = readFileSync(
    resolve(process.cwd(), "src/lib/stripe/webhookProcess.ts"),
    "utf-8",
  );

  it("INSERTs event_id into stripe_webhook_events", () => {
    expect(TS).toMatch(/from\("stripe_webhook_events"\)/);
    expect(TS).toMatch(/\.insert\(\{\s*event_id:\s*eventId\s*\}\)/);
  });

  it("treats unique-violation (23505) as already-processed", () => {
    expect(TS).toMatch(/23505/);
  });

  it("fail-safes on non-23505 errors (process event without dedup)", () => {
    expect(TS).toMatch(
      /processing event without dedup/i,
    );
  });

  it("removes the in-memory Set + MAX_CACHED_EVENTS", () => {
    // The previous module-level Set / cap caused dedup to vanish on
    // every cold start. Pin the absence so a future refactor can't
    // silently re-introduce the in-memory primitive (which felt right
    // but was the bug).
    expect(TS).not.toMatch(/processedEventIds = new Set/);
    expect(TS).not.toMatch(/MAX_CACHED_EVENTS/);
  });

  it("keeps _clearProcessedEventsForTesting export as a no-op for back-compat", () => {
    expect(TS).toMatch(/export function _clearProcessedEventsForTesting\(\)/);
  });
});
