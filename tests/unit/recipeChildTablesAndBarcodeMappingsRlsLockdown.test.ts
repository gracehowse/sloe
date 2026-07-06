/**
 * ENG-1396/ENG-1397 (2026-07-05 deep audit, live-DB security & RLS,
 * findings SEC-02 / SEC-03 / DI-02) — static contract tests pinning the RLS
 * lockdown migrations for recipe_ingredients/recipe_steps SELECT and
 * barcode_mappings writes.
 *
 * Migration-text assertions (same approach as userFoodsInsertLockdown.test.ts)
 * because this harness does not run pgTAP / a live Postgres in CI. Live
 * exploit verification (both directions: draft hidden, published visible;
 * client INSERT blocked, service-role INSERT unaffected) was run manually
 * against the production database in a rolled-back transaction — see the
 * ENG-1396/ENG-1397 Linear comments for the exact queries and results.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");

const RECIPE_CHILD_SELECT = readFileSync(
  resolve(MIGRATIONS_DIR, "20260706100000_eng1396_recipe_ingredients_steps_select_lockdown.sql"),
  "utf8",
);
const BARCODE_WRITE_LOCKDOWN = readFileSync(
  resolve(MIGRATIONS_DIR, "20260706100100_eng1397_barcode_mappings_write_lockdown.sql"),
  "utf8",
);
// Comment-stripped view for assertions about what the migration does NOT do —
// the header comment discusses service_role/RLS in prose, which would
// otherwise false-positive a "does not mention X" check.
const BARCODE_WRITE_LOCKDOWN_SQL = BARCODE_WRITE_LOCKDOWN.replace(/^\s*--.*$/gm, "");

describe("ENG-1396 — recipe_ingredients/recipe_steps SELECT mirrors the parent recipes policy", () => {
  it("drops the USING(true) public-read policies on both child tables", () => {
    expect(RECIPE_CHILD_SELECT).toMatch(
      /drop\s+policy\s+if\s+exists\s+"recipe_ingredients_select_public"\s+on\s+public\.recipe_ingredients/i,
    );
    expect(RECIPE_CHILD_SELECT).toMatch(
      /drop\s+policy\s+if\s+exists\s+"recipe_steps_select_public"\s+on\s+public\.recipe_steps/i,
    );
  });

  it("recreates SELECT gated on published OR own OR saved, for both tables", () => {
    // Mirrors recipes_select_published_own_or_saved's exact three-part condition.
    for (const table of ["recipe_ingredients", "recipe_steps"]) {
      const createBlockMatch = RECIPE_CHILD_SELECT.match(
        new RegExp(
          `create\\s+policy\\s+"${table}_select_published_own_or_saved"[\\s\\S]*?on\\s+public\\.${table}[\\s\\S]*?;`,
          "i",
        ),
      );
      expect(createBlockMatch, `expected a CREATE POLICY block for ${table}`).not.toBeNull();
      const block = createBlockMatch![0];
      expect(block).toMatch(/r\.published\s*=\s*true/i);
      expect(block).toMatch(/r\.author_id\s*=\s*\(select\s+auth\.uid\(\)\)/i);
      expect(block).toMatch(/from\s+public\.saves\s+s/i);
    }
  });

  it("joins to the parent recipes table by recipe_id (not a self-referential subquery)", () => {
    expect(RECIPE_CHILD_SELECT).toMatch(/r\.id\s*=\s*recipe_ingredients\.recipe_id/i);
    expect(RECIPE_CHILD_SELECT).toMatch(/r\.id\s*=\s*recipe_steps\.recipe_id/i);
  });

  it("reloads the PostgREST schema cache", () => {
    expect(RECIPE_CHILD_SELECT).toMatch(/notify\s+pgrst,\s*'reload schema'/i);
  });
});

describe("ENG-1397 — barcode_mappings client writes are locked down to the service-role route", () => {
  it("drops both client-facing write policies", () => {
    expect(BARCODE_WRITE_LOCKDOWN).toMatch(
      /drop\s+policy\s+if\s+exists\s+"barcode_mappings_write_own"\s+on\s+public\.barcode_mappings/i,
    );
    expect(BARCODE_WRITE_LOCKDOWN).toMatch(
      /drop\s+policy\s+if\s+exists\s+"barcode_mappings_update_own"\s+on\s+public\.barcode_mappings/i,
    );
  });

  it("revokes INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER from anon and authenticated", () => {
    expect(BARCODE_WRITE_LOCKDOWN).toMatch(
      /revoke\s+insert,\s*update,\s*delete,\s*truncate,\s*trigger\s+on\s+public\.barcode_mappings\s+from\s+anon,\s*authenticated/i,
    );
  });

  it("does not touch the public SELECT policy (barcode lookups stay public)", () => {
    expect(BARCODE_WRITE_LOCKDOWN_SQL).not.toMatch(/drop\s+policy[\s\S]*barcode_mappings_select_public/i);
    expect(BARCODE_WRITE_LOCKDOWN_SQL).not.toMatch(/revoke\s+select/i);
  });

  it("does not revoke from service_role (the app's actual write path)", () => {
    expect(BARCODE_WRITE_LOCKDOWN_SQL).not.toMatch(/service_role/i);
  });

  it("reloads the PostgREST schema cache", () => {
    expect(BARCODE_WRITE_LOCKDOWN).toMatch(/notify\s+pgrst,\s*'reload schema'/i);
  });
});
