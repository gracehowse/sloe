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
