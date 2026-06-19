/**
 * F-138 Phase 1 (P0 schema hardening) — pin the migration + read-path
 * code so future agents can't silently regress the audit fixes.
 *
 * What this guards:
 *   - The migration file exists and contains all 5 P0 items
 *   - `lookupBarcode` reads from `verified_food_canonical` first
 *   - `lookupBarcode` filters out `verification_status = 'rejected'`
 *   - The lex-sort bug is gone (no `order by verification_status asc`
 *     pretending 'verified' sorts before 'pending')
 *
 * Decision doc: `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`
 * Migration: `supabase/migrations/20260512100000_user_foods_p0_hardening.sql`
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("F-138 Phase 1 — P0 schema migration", () => {
  const SQL = read("supabase/migrations/20260512100000_user_foods_p0_hardening.sql");

  it("declares the numeric constraint pack on user_foods", () => {
    expect(SQL).toMatch(/user_foods_calories_bounds[\s\S]{0,200}calories\s*<=\s*2000/);
    expect(SQL).toMatch(/user_foods_protein_bounds[\s\S]{0,200}protein\s*<=\s*100/);
    expect(SQL).toMatch(/user_foods_sodium_bounds[\s\S]{0,200}sodium_mg\s*(?:>=\s*0\s*and\s*sodium_mg\s*)?<=\s*50000/);
    expect(SQL).toMatch(/user_foods_barcode_length[\s\S]{0,200}length\(barcode\)\s+between\s+8\s+and\s+14/);
    expect(SQL).toMatch(/user_foods_name_nonempty/);
  });

  it("declares structural subset constraints (sugar/satfat/fiber)", () => {
    expect(SQL).toMatch(/user_foods_sugar_le_carbs[\s\S]{0,300}sugar_g\s*<=\s*carbs/);
    expect(SQL).toMatch(/user_foods_satfat_le_fat[\s\S]{0,300}saturated_fat_g\s*<=\s*fat/);
    expect(SQL).toMatch(/user_foods_fiber_le_carbs[\s\S]{0,300}fiber_g\s*<=\s*carbs/);
  });

  it("tightens SELECT RLS to verified-or-own only", () => {
    // Pre-fix policy `using (true)` is dropped; new policy has the
    // verified-or-own predicate.
    expect(SQL).toMatch(
      /create policy "Authenticated users can read verified or own user foods"[\s\S]{0,600}verification_status\s*=\s*'verified'[\s\S]{0,200}submitted_by\s*=\s*auth\.uid\(\)/,
    );
  });

  it("creates admin_users table for state-machine guard", () => {
    expect(SQL).toMatch(/create table if not exists public\.admin_users/);
    expect(SQL).toMatch(/user_id uuid primary key/);
  });

  it("guards verification_status transitions via trigger", () => {
    expect(SQL).toMatch(/user_foods_guard_status_transition/);
    expect(SQL).toMatch(/Only admins can change verification_status/);
    expect(SQL).toMatch(/exists\s*\(\s*select\s+1\s+from\s+public\.admin_users/);
  });

  it("resets verification_status to pending when nutrition columns change", () => {
    expect(SQL).toMatch(/user_foods_reset_verification_on_macro_edit/);
    expect(SQL).toMatch(/macro_changed[\s\S]{0,400}is distinct from old\.calories/);
    expect(SQL).toMatch(/new\.verification_status := 'pending'/);
  });

  it("creates verified_food_canonical projection table with FK to source", () => {
    expect(SQL).toMatch(/create table if not exists public\.verified_food_canonical/);
    expect(SQL).toMatch(/source_user_food_id uuid references public\.user_foods\(id\)/);
    expect(SQL).toMatch(/consensus_method/);
  });

  it("provides recompute_verified_food_canonical(text) function", () => {
    expect(SQL).toMatch(/create or replace function public\.recompute_verified_food_canonical/);
    // Must DELETE the canonical when no verified row exists (so
    // lookupBarcode falls through to OFF after rejections).
    expect(SQL).toMatch(/delete from public\.verified_food_canonical where barcode/);
  });

  it("auto-recomputes canonical via after-trigger on user_foods", () => {
    expect(SQL).toMatch(/user_foods_after_status_change/);
    expect(SQL).toMatch(/perform public\.recompute_verified_food_canonical/);
  });

  it("backfills canonical for existing verified rows at migration time", () => {
    expect(SQL).toMatch(/select distinct barcode from public\.user_foods where verification_status = 'verified'/);
  });
});

describe("F-138 Phase 1 — lookupBarcode read path uses canonical first", () => {
  const SRC = read("apps/mobile/lib/verifyRecipe.ts");

  it("queries verified_food_canonical via PK lookup before user_foods", () => {
    // The canonical lookup happens BEFORE the user_foods read. Match a
    // narrow window and assert it appears first.
    const fnIdx = SRC.indexOf("export async function lookupBarcode");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = SRC.slice(fnIdx, fnIdx + 4000);
    const canonIdx = fnSlice.indexOf("verified_food_canonical");
    const userFoodsIdx = fnSlice.indexOf('.from("user_foods")');
    expect(canonIdx).toBeGreaterThan(-1);
    expect(userFoodsIdx).toBeGreaterThan(canonIdx);
  });

  it("filters out rejected rows in the user_foods fallback", () => {
    expect(SRC).toMatch(/\.neq\(["']verification_status["'],\s*["']rejected["']\)/);
  });

  it("does not use the wrong-direction lex sort on verification_status", () => {
    // Pre-fix: `.order("verification_status", { ascending: true })`
    // sorted 'pending' before 'verified' alphabetically — a latent bug
    // masked by the `find(...verified)` fallback. Post-fix: PK hit on
    // canonical table, no lex sort needed.
    const fnIdx = SRC.indexOf("export async function lookupBarcode");
    const fnSlice = SRC.slice(fnIdx, fnIdx + 4000);
    expect(fnSlice).not.toMatch(
      /\.order\(["']verification_status["'],\s*\{\s*ascending:\s*true/,
    );
  });

  it("reports the canonical/user_foods read failure to Sentry instead of swallowing it (ENG-717)", () => {
    // The lookup's try/catch falls through to Open Food Facts on failure,
    // but the failure must not be silent — a broken read (RLS regression,
    // schema drift, network) has to surface in Sentry.
    const fnIdx = SRC.indexOf("export async function lookupBarcode");
    const fnSlice = SRC.slice(fnIdx, fnIdx + 4000);
    // The catch binds the error and routes it to captureException.
    expect(fnSlice).toMatch(/catch\s*\(\s*e\s*\)\s*\{[\s\S]*?captureException\(e\)/);
    // And it is no longer the old empty `catch {}` swallow.
    expect(fnSlice).not.toMatch(/catch\s*\{\s*\/\/ Fall through to Open Food Facts\s*\}/);
  });

  it("imports captureException from the mobile errorTracking module", () => {
    expect(SRC).toMatch(/import\s*\{\s*captureException\s*\}\s*from\s*["']\.\/errorTracking["']/);
  });

  it("does not log the per-search hit-count on the hot path (ENG-717)", () => {
    // The `[searchFoods] … hits` console.log fired on every search — removed.
    expect(SRC).not.toContain("[searchFoods] q=");
  });
});
