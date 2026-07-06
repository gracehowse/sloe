/**
 * ENG-1413 (2026-07-05 deep audit, production readiness, PRA-012/IM-14,
 * pg_trgm half) — static contract test pinning the trigram index migration.
 *
 * Migration-text assertion (no live Postgres in CI). Live verification was
 * run manually against production: confirmed via EXPLAIN that the planner
 * picks a sequential scan today (the table has 7 rows — genuinely correct
 * at this scale) and confirmed via `SET LOCAL enable_seqscan = off` that
 * the index is valid and gets used the moment the cost model favours it —
 * see the ENG-1413 Linear comment for the exact queries and plans.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260706110000_eng1413_user_foods_name_trigram_index.sql",
  ),
  "utf8",
);

describe("ENG-1413 — user_foods.name trigram index for the per-ingredient ilike lookup", () => {
  it("enables pg_trgm in the extensions schema (project convention)", () => {
    expect(MIGRATION).toMatch(/create\s+extension\s+if\s+not\s+exists\s+"pg_trgm"\s+with\s+schema\s+extensions/i);
  });

  it("creates a GIN trigram index on user_foods.name", () => {
    expect(MIGRATION).toMatch(
      /create\s+index\s+if\s+not\s+exists\s+idx_user_foods_name_trgm\s+on\s+public\.user_foods\s+using\s+gin\s*\(\s*name\s+extensions\.gin_trgm_ops\s*\)/i,
    );
  });
});
