import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ENG-1389 — DB grant/throttle hardening round 2. There is no live DB in CI
 * (the migration-apply rule forbids `db push` here), so the live effect is
 * confirmed by the Supabase advisor after Grace pushes. This file pins the
 * migration SOURCE so a refactor can't silently drop a revoke, loosen the
 * throttle, or revert the search_path pin.
 *
 * Pattern mirrors eng1307RpcExecuteLockdown / revenuecatEventsMigration.
 */

const SQL = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720090000_eng1389_db_grant_hardening_round2.sql",
  ),
  "utf-8",
);

// Executable SQL only — `--` line comments stripped, whitespace normalised, so
// prose in the header can't satisfy (or trip) a statement assertion.
const CODE = SQL.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

describe("ENG-1389 DB grant hardening — SEC-08 billing table write revoke", () => {
  it("revokes the client write surface on both webhook tables, both roles", () => {
    for (const table of ["revenuecat_events", "stripe_webhook_events"]) {
      expect(CODE).toContain(
        `revoke insert, update, delete, truncate, references, trigger on table public.${table} from anon, authenticated;`,
      );
    }
  });

  it("does NOT revoke SELECT on the webhook tables (RLS-inert; advisor residual)", () => {
    // The finding is the excess WRITE grants; SELECT is already RLS default-deny.
    // A `revoke ... select ...` (or blanket `revoke all`) on these tables would
    // be a scope change — pin its absence.
    expect(CODE).not.toMatch(/revoke[^;]*\bselect\b[^;]*revenuecat_events/);
    expect(CODE).not.toMatch(/revoke[^;]*\bselect\b[^;]*stripe_webhook_events/);
    expect(CODE).not.toMatch(/revoke all[^;]*revenuecat_events/);
    expect(CODE).not.toMatch(/revoke all[^;]*stripe_webhook_events/);
  });
});

describe("ENG-1389 DB grant hardening — SEC-09 household join throttle", () => {
  it("creates a per-user primary-key throttle table (ENG-1103 primitive)", () => {
    expect(CODE).toMatch(
      /create table if not exists public\.household_join_throttle \( user_id uuid primary key references auth\.users \(id\) on delete cascade, failed_count integer not null default 0 check \(failed_count >= 0\), window_started timestamptz not null default now\(\) \)/,
    );
  });

  it("locks the throttle table down: RLS on + revoke all from anon, authenticated", () => {
    expect(CODE).toContain(
      "alter table public.household_join_throttle enable row level security;",
    );
    expect(CODE).toContain(
      "revoke all on table public.household_join_throttle from anon, authenticated;",
    );
    // Definer-only: no client policy may exist on the throttle table.
    expect(CODE).not.toMatch(/create policy[^;]*household_join_throttle/);
  });

  it("rejects once over the cap with a rate_limited error", () => {
    expect(CODE).toMatch(/if coalesce\(v_failed, 0\) >= 10 then/);
    expect(CODE).toMatch(/'error', 'rate_limited'/);
  });

  it("increments the counter on a wrong-code guess (invalid_code path)", () => {
    // The increment upsert must sit with the invalid_code branch.
    expect(CODE).toMatch(
      /insert into public\.household_join_throttle \(user_id, failed_count, window_started\) values \(v_uid, 1, now\(\)\) on conflict \(user_id\) do update/,
    );
  });

  it("resets the counter on success (failed_count = 0)", () => {
    expect(CODE).toMatch(
      /update public\.household_join_throttle set failed_count = 0, window_started = now\(\) where user_id = v_uid;/,
    );
  });

  it("preserves the T20 disbanded / expiry guards in the rewritten function", () => {
    expect(CODE).toMatch(/'error', 'household_disbanded'/);
    expect(CODE).toMatch(/'error', 'invite_expired'/);
    expect(CODE).toMatch(/if v_household\.disbanded_at is not null then/);
    expect(CODE).toMatch(
      /v_household\.invite_code_expires_at is not null and v_household\.invite_code_expires_at <= now\(\)/,
    );
  });

  it("keeps the definer + pinned search_path + authenticated-only grant", () => {
    expect(CODE).toMatch(
      /create or replace function public\.household_join_by_invite_code\( p_invite_code text, p_display_name text default null \) returns jsonb language plpgsql security definer set search_path = public, pg_temp/,
    );
    expect(CODE).toContain(
      "grant execute on function public.household_join_by_invite_code(text, text) to authenticated;",
    );
    // Must never re-grant anon (ENG-1307 revoked it).
    expect(CODE).not.toMatch(/grant[^;]*household_join_by_invite_code[^;]*anon/);
  });
});

describe("ENG-1389 DB grant hardening — NEW-A search_path pin", () => {
  it("pins search_path = '' on the trigger-only touch fn (ENG-1307 class D)", () => {
    expect(CODE).toContain(
      "alter function public.ingredient_image_aliases_touch_updated_at() set search_path = '';",
    );
  });

  it("revokes the RPC surface on the trigger-only touch fn (all roles)", () => {
    expect(CODE).toContain(
      "revoke execute on function public.ingredient_image_aliases_touch_updated_at() from public, anon, authenticated;",
    );
  });
});

describe("ENG-1389 migration hygiene", () => {
  it("runs inside one explicit transaction and reloads the PostgREST cache", () => {
    expect(CODE).toMatch(/(^| )begin;/);
    expect(CODE).toMatch(/ commit;/);
    expect(CODE).toContain("notify pgrst, 'reload schema';");
  });
});
