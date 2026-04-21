/**
 * Library — desktop prototype port pin (2026-04-20).
 *
 * Grace's 2026-04-19 Claude Design prototype
 * (`docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * `WebLibrary`) replaced the legacy live Library desktop layout
 * with a prototype-flat grid. This test pins the structural
 * markers so drift is caught in CI rather than on-device.
 *
 * Pins (desktop at `md+`):
 *   1. A `library-desktop-grid` test id renders a `md:grid` (so the
 *      desktop variant is distinct from the mobile-web fallback).
 *   2. Each card renders a fit-% pill (`library-fit-{id}`) sourced
 *      from the shared `computeRecipeFitPercent` helper — parity
 *      with Discover's 2026-04-20 port.
 *   3. Saved-kind cards render a bookmark dot
 *      (`library-saved-dot-{id}`) instead of the kcal overlay, so
 *      the Saved filter pill result is visually recognisable from
 *      scroll distance.
 *   4. The filter pill row uses the shared `LIBRARY_FILTER_PILLS`
 *      (All · Saved · High-Protein · Quick · Vegetarian · Created
 *      · Imported) — web + mobile no longer diverge on filter set.
 *   5. The legacy mobile-web card layout is preserved below `md`
 *      (`md:hidden` wrapper) so narrow widths keep parity with the
 *      live mobile-web experience until the narrow port lands.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const LIBRARY_PATH = resolve(ROOT, "src/app/components/Library.tsx");
const FILTERS_PATH = resolve(ROOT, "src/lib/recipes/libraryFilters.ts");

const SRC = readFileSync(LIBRARY_PATH, "utf8");
const FILTERS_SRC = readFileSync(FILTERS_PATH, "utf8");

describe("Library — desktop prototype port (2026-04-20)", () => {
  describe("desktop grid marker", () => {
    it("renders a `library-desktop-grid` test id on a `hidden md:grid` container", () => {
      expect(SRC).toMatch(/data-testid="library-desktop-grid"/);
      expect(SRC).toMatch(/hidden md:grid/);
    });

    it("keeps the legacy mobile-web layout gated behind `md:hidden`", () => {
      expect(SRC).toMatch(/grid grid-cols-1 gap-6 md:hidden/);
    });
  });

  describe("fit-% pill (parity with Discover 2026-04-20 port)", () => {
    it("imports and calls `computeRecipeFitPercent`", () => {
      expect(SRC).toMatch(/computeRecipeFitPercent/);
    });

    it("renders a `library-fit-{id}` test id per desktop card", () => {
      expect(SRC).toMatch(/library-fit-\$\{recipe\.id\}/);
    });

    it("styles the fit pill with primary-tinted bg + tabular nums (prototype spec)", () => {
      expect(SRC).toMatch(/bg-primary\/15 text-primary[^"]*tabular-nums/);
    });
  });

  describe("saved bookmark dot", () => {
    it("renders a `library-saved-dot-{id}` test id for Saved-kind cards", () => {
      expect(SRC).toMatch(/library-saved-dot-\$\{recipe\.id\}/);
    });
  });

  describe("shared filter pill set", () => {
    it("imports `LIBRARY_FILTER_PILLS` + `matchesNutritionPill` from the shared helper", () => {
      expect(SRC).toMatch(/LIBRARY_FILTER_PILLS/);
      expect(SRC).toMatch(/matchesNutritionPill/);
    });

    it("renders a `library-filter-pills` test id around the pill row", () => {
      expect(SRC).toMatch(/data-testid="library-filter-pills"/);
    });

    it("shared helper still exports the prototype-ordered pill set", () => {
      // Paranoia: if the helper order or contents change, this spec
      // also flags. The prototype order is All · Saved · High-Protein
      // · Quick · Vegetarian · Created · Imported.
      expect(FILTERS_SRC).toMatch(/id:\s*"all"[\s\S]*id:\s*"saved"[\s\S]*id:\s*"high-protein"[\s\S]*id:\s*"quick"[\s\S]*id:\s*"vegetarian"/);
    });
  });

  describe("preserved behaviour (regression guards)", () => {
    it("still exposes the sort cycle (Recent → Calories → Protein)", () => {
      expect(SRC).toMatch(/cycleSort/);
      expect(SRC).toMatch(/sortKey/);
    });

    it("still renders the Go-public CTA for unpublished created recipes", () => {
      expect(SRC).toMatch(/Go public/);
    });

    it("still renders the Create-your-own-version CTA for imported recipes", () => {
      expect(SRC).toMatch(/Create your own version/);
    });

    it("still renders the empty-state with a Go-to-Discover CTA", () => {
      expect(SRC).toMatch(/Your library is empty/);
      expect(SRC).toMatch(/Go to Discover/);
    });
  });
});
