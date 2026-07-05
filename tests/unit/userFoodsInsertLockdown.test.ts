/**
 * ENG-1393 (2026-07-05 deep audit, live-DB security & RLS, finding DI-01) —
 * static contract tests for the BEFORE INSERT user_foods verification-status
 * lockdown guard.
 *
 * These pin the migration SQL so a future edit can't silently re-open the
 * born-verified corpus-poisoning hole. Migration-text assertions (same
 * approach as profilesInsertLockdown.test.ts) because this harness does not
 * run pgTAP / a live Postgres in CI.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");

const INSERT_LOCKDOWN = readFileSync(
  resolve(MIGRATIONS_DIR, "20260705150000_eng1393_user_foods_insert_lockdown.sql"),
  "utf8",
);

describe("ENG-1393 — user_foods BEFORE INSERT verification lockdown", () => {
  it("attaches a BEFORE INSERT trigger on public.user_foods", () => {
    expect(INSERT_LOCKDOWN).toMatch(
      /create\s+trigger\s+user_foods_insert_lockdown_trg[\s\S]*?before\s+insert\s+on\s+public\.user_foods/i,
    );
  });

  it("rejects an inserted verification_status that is anything other than 'pending'", () => {
    // Compares NEW against the allowed default, not OLD (which is NULL on
    // INSERT) — so a default-pending submission still succeeds.
    expect(INSERT_LOCKDOWN).toMatch(
      /new\.verification_status\s+is\s+not\s+null\s+and\s+new\.verification_status\s+is\s+distinct\s+from\s+'pending'/i,
    );
    expect(INSERT_LOCKDOWN).toMatch(/errcode\s*=\s*'42501'/i);
  });

  it("rejects a non-null verified_by or verified_at on insert", () => {
    expect(INSERT_LOCKDOWN).toMatch(/new\.verified_by\s+is\s+not\s+null/i);
    expect(INSERT_LOCKDOWN).toMatch(/new\.verified_at\s+is\s+not\s+null/i);
  });

  it("rejects non-zero upvotes/downvotes on insert", () => {
    expect(INSERT_LOCKDOWN).toMatch(
      /coalesce\(new\.upvotes,\s*0\)\s*<>\s*0\s+or\s+coalesce\(new\.downvotes,\s*0\)\s*<>\s*0/i,
    );
  });

  it("lets service-role writers (consensus job, admin tooling) bypass", () => {
    expect(INSERT_LOCKDOWN).toMatch(/auth\.role\(\)\s*=\s*'service_role'/i);
  });

  it("pins search_path on the trigger function (ENG-845 hardening convention)", () => {
    expect(INSERT_LOCKDOWN).toMatch(
      /create\s+or\s+replace\s+function\s+public\.user_foods_insert_lockdown\(\)[\s\S]*?security\s+invoker[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp[\s\S]*?as\s+\$\$/i,
    );
  });

  it("reloads PostgREST schema cache", () => {
    expect(INSERT_LOCKDOWN).toMatch(/notify\s+pgrst,\s*'reload schema'/i);
  });
});
