/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const normalize = (value: string) => value.replace(/\s+/g, " ");

describe("ENG-870 recipe claim migration security", () => {
  const sql = read("supabase/migrations/20260702120000_eng870_recipe_claim.sql");
  const normalized = normalize(sql);

  it("keeps the claim audit table default-deny for client roles", () => {
    expect(normalized).toMatch(/alter table public\.recipe_claims enable row level security/i);
    expect(normalized).toMatch(/revoke all on table public\.recipe_claims from anon, authenticated/i);
  });

  it("requires claimed recipes to carry verified source-ownership proof", () => {
    expect(normalized).toContain("recipes_claimed_requires_verified_claim");
    expect(normalized).toContain("published is true");
    expect(normalized).toContain("claimed_by is not null");
    expect(normalized).toContain("claimed_at is not null");
    expect(normalized).toContain("claim_verification->>'method' in ('oauth_handle', 'bio_code', 'dns_meta')");
    expect(normalized).toContain("coalesce(claim_verification->>'source_url', '') = source_url");
    expect(normalized).toContain("coalesce((claim_verification->>'attestation')::boolean, false) is true");
    expect(normalized).toContain("length(coalesce(claim_verification->>'verified_at', '')) > 0");
  });

  it("prevents normal recipe owners from self-writing claim state", () => {
    const updatePolicyStart = normalized.indexOf('CREATE POLICY "recipes_update_own"');
    const insertPolicyStart = normalized.indexOf('CREATE POLICY "recipes_insert_own"');
    expect(updatePolicyStart).toBeGreaterThan(-1);
    expect(insertPolicyStart).toBeGreaterThan(-1);

    const updatePolicy = normalized.slice(updatePolicyStart, insertPolicyStart);
    const insertPolicy = normalized.slice(insertPolicyStart);

    for (const policy of [updatePolicy, insertPolicy]) {
      expect(policy).toContain("content_origin <> 'claimed'");
      expect(policy).toContain("claimed_by IS NULL");
      expect(policy).toContain("claimed_at IS NULL");
      expect(policy).toContain("claim_verification IS NULL");
    }
  });
});

/**
 * ENG-1243 — forward-fix migration. The base eng870 migration above is recorded
 * APPLIED in schema_migrations, so `db push` skips it and its claim-RLS guards
 * never reached the live DB (verified read-only 2026-06-23: live
 * recipes_update_own/insert_own had NO claim guards). This new forward migration
 * re-applies them as a fresh version so db push runs it.
 *
 * NOTE: these file-text assertions are necessary-but-NOT-sufficient — the base
 * migration passed identical checks while prod stayed vulnerable. The authoritative
 * gate is re-reading pg_policy on the live DB AFTER `supabase db push --linked`.
 */
describe("ENG-1243 recipe claim RLS forward-fix migration", () => {
  const sql = read(
    "supabase/migrations/20260702120300_eng870_recipe_claim_rls_forward_fix.sql",
  );
  const normalized = normalize(sql);

  it("re-creates recipes_update_own with claim guards in BOTH using and with-check", () => {
    const start = normalized.indexOf('CREATE POLICY "recipes_update_own"');
    const end = normalized.indexOf('CREATE POLICY "recipes_insert_own"');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const policy = normalized.slice(start, end);
    const usingClause = policy.slice(
      policy.indexOf("USING ("),
      policy.indexOf("WITH CHECK"),
    );
    const withCheck = policy.slice(policy.indexOf("WITH CHECK"));

    // The de-claim block lives in USING (can't even target a claimed row);
    // the self-claim block lives in WITH CHECK (result must stay unclaimed).
    for (const clause of [usingClause, withCheck]) {
      expect(clause).toContain("content_origin <> 'claimed'");
      expect(clause).toContain("claimed_by IS NULL");
      expect(clause).toContain("claimed_at IS NULL");
      expect(clause).toContain("claim_verification IS NULL");
    }
  });

  it("re-creates recipes_insert_own with claim guards", () => {
    const start = normalized.indexOf('CREATE POLICY "recipes_insert_own"');
    expect(start).toBeGreaterThan(-1);
    const policy = normalized.slice(start);
    expect(policy).toContain("content_origin <> 'claimed'");
    expect(policy).toContain("claimed_by IS NULL");
    expect(policy).toContain("claimed_at IS NULL");
    expect(policy).toContain("claim_verification IS NULL");
  });

  it("re-locks the recipe_claims audit log (RLS on + grants revoked)", () => {
    // Adversarial-verify lens 3 (P0): live recipe_claims had RLS DISABLED and
    // anon+authenticated holding full grants incl. DELETE/TRUNCATE — the same
    // drift as the policies. The forward migration must re-secure it.
    expect(normalized).toMatch(
      /ALTER TABLE public\.recipe_claims ENABLE ROW LEVEL SECURITY/i,
    );
    expect(normalized).toMatch(
      /REVOKE ALL ON TABLE public\.recipe_claims FROM anon, authenticated/i,
    );
  });

  it("re-adds the recipes_claimed_requires_verified_claim CHECK constraint", () => {
    expect(normalized).toContain("recipes_claimed_requires_verified_claim");
    expect(normalized).toContain("content_origin <> 'claimed'");
    expect(normalized).toContain(
      "claim_verification->>'method' IN ('oauth_handle', 'bio_code', 'dns_meta')",
    );
  });
});

describe("ENG-1235 recipe claim idempotency migration", () => {
  const sql = read(
    "supabase/migrations/20260702120800_eng1235_recipe_claim_idempotency.sql",
  );
  const normalized = normalize(sql);

  it("adds one verified claim row per recipe claimant", () => {
    expect(normalized).toContain("create unique index if not exists recipe_claims_verified_recipe_claimant_uidx");
    expect(normalized).toContain("on public.recipe_claims(recipe_id, claimant_id)");
    expect(normalized).toContain("where status = 'verified'");
  });
});
