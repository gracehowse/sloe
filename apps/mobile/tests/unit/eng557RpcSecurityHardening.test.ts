/**
 * ENG-557 — SECURITY DEFINER RPC hardening migration guard.
 *
 * Pins the audit fixes so a future agent can't silently regress them:
 *   - F2 (P1): recompute_verified_food_canonical EXECUTE revoked from
 *     public/anon/authenticated (it's trigger-only; the exposed RPC was
 *     an unauthenticated write primitive).
 *   - F1 (P2): redeem_promo_code search_path pinned to `public, pg_temp`.
 *
 * Audit: security-reviewer 2026-06-02. Verified live before/after via the
 * Supabase advisor + has_function_privilege.
 * Migration: supabase/migrations/20260602120000_eng557_rpc_security_hardening.sql
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SQL = readFileSync(
  resolve(REPO, "supabase/migrations/20260602120000_eng557_rpc_security_hardening.sql"),
  "utf8",
);

describe("ENG-557 — RPC security hardening migration", () => {
  it("revokes EXECUTE on recompute_verified_food_canonical from public/anon/authenticated (F2 P1)", () => {
    expect(SQL).toMatch(
      /revoke\s+execute\s+on\s+function\s+public\.recompute_verified_food_canonical\(text\)\s+from\s+public,\s*anon,\s*authenticated/i,
    );
  });

  it("pins redeem_promo_code search_path to public, pg_temp (F1 P2)", () => {
    expect(SQL).toMatch(
      /alter\s+function\s+public\.redeem_promo_code\(text\)[\s\S]{0,80}set\s+search_path\s*=\s*public,\s*pg_temp/i,
    );
  });
});
