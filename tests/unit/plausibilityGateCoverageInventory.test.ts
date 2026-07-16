/**
 * ENG-1428 — meta-test pinning the inventory of nutrition-LOGGING entry
 * points and asserting each one actually calls a plausibility check before
 * the number reaches the user's totals.
 *
 * Sibling of `nutritionEntriesGuardInventory.test.ts` (which inventories
 * `nutrition_entries` insert sites against the macro-COERCION guard). This
 * file inventories the same kind of surface against the PLAUSIBILITY gate
 * instead — a different concern: coercion asks "did we invent this number
 * from nothing", plausibility asks "does this number make physical sense
 * (Atwater 4/4/9, or an absolute per-100g ceiling)".
 *
 * Why this exists (ENG-1428 / mp-F5/plaus-F5, 2026-07-05 deep audit): no
 * inventory tracked which nutrition-logging paths ran a plausibility check
 * at all — the structural reason 6 of 7 ungated paths in that audit shipped
 * unnoticed. Unlike the coercion-guard sibling, there is no single shared
 * `GUARD_RE` here — different entry points call different, purpose-built
 * checks (`checkScaledLogPlausibility` for scaled/portioned logging,
 * `checkItemMacroConsistency` for photo-log's no-ceiling item shape,
 * `verifyIngredients`'s internal per-provider Atwater checks for anything
 * that resolves ingredients, `scaledMacrosPlausible` for direct macro
 * submission) — so each entry records its OWN marker.
 *
 * Adding a new nutrition-logging entry point? Either wire it through an
 * existing plausibility check and add a row here, or document why this
 * specific path is exempt (e.g. external provenance that's already been
 * plausibility-checked upstream, like HealthKit reads).
 *
 * NOT YET COVERED — do not silently drop: manual custom-food creation
 * (`app/api/custom-foods/route.ts`) now runs `scaledMacrosPlausible` too
 * (ENG-1420), but that route only exists on PR #914, not yet merged to
 * `main` as of this writing. Add its row here in the same change that
 * merges #914 — tracked, not forgotten.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../..");

type PlausibilityEntry = {
  /** Human-readable name of the logging surface, for the test title. */
  label: string;
  /** Path relative to repo root of the file that wires the gate in. */
  file: string;
  /** The specific plausibility-check call/import this file must contain. */
  guardMarker: RegExp;
};

/**
 * Authoritative inventory of nutrition-logging entry points and the
 * plausibility check each one runs before the number reaches the user's
 * totals. Keep in sync with `docs/product/nutrition-approximation-policy.md`
 * if/when that doc gains a plausibility-specific section.
 */
const INVENTORY: PlausibilityEntry[] = [
  {
    label: "Barcode scan (web today-barcode-dialog)",
    file: "src/app/components/suppr/today-barcode-dialog.tsx",
    guardMarker: /checkScaledLogPlausibility/,
  },
  {
    label: "Barcode scan (mobile barcode tab)",
    file: "apps/mobile/app/(tabs)/barcode.tsx",
    guardMarker: /checkScaledLogPlausibility/,
  },
  {
    label: "Barcode scan (mobile BarcodeScannerModal)",
    file: "apps/mobile/components/BarcodeScannerModal.tsx",
    guardMarker: /checkScaledLogPlausibility/,
  },
  {
    label: "AI photo-log (analyse + refine, shared parser)",
    file: "src/lib/nutrition/photoLogRanges.ts",
    guardMarker: /checkItemMacroConsistency/,
  },
  {
    label: "AI voice-log",
    file: "app/api/nutrition/voice-log/route.ts",
    guardMarker: /verifyIngredients/,
  },
  {
    label: "Recipe-import verify (paste/text ingredients)",
    file: "app/api/nutrition/verify-recipe/route.ts",
    guardMarker: /verifyIngredients/,
  },
  {
    label: "Recipe-import (social caption)",
    file: "app/api/recipe-import/caption/route.ts",
    guardMarker: /verifyIngredients/,
  },
  {
    label: "Recipe-import (image OCR)",
    file: "app/api/recipe-import/image/route.ts",
    guardMarker: /verifyIngredients/,
  },
  {
    label: "Plan-import parse",
    file: "app/api/plan-import/parse/route.ts",
    guardMarker: /verifyIngredients/,
  },
  {
    label: "User-foods submit (community barcode contribution)",
    file: "app/api/user-foods/route.ts",
    guardMarker: /scaledMacrosPlausible/,
  },
];

describe("nutrition-logging plausibility-gate coverage inventory", () => {
  for (const entry of INVENTORY) {
    it(`${entry.label} — wires ${entry.guardMarker}`, () => {
      const text = readFileSync(resolve(REPO, entry.file), "utf8");
      expect(text).toMatch(entry.guardMarker);
    });
  }

  it("inventory has no duplicate (label, file) rows", () => {
    const seen = new Set<string>();
    for (const entry of INVENTORY) {
      const key = `${entry.label}::${entry.file}`;
      expect(seen.has(key), `duplicate inventory row: ${key}`).toBe(false);
      seen.add(key);
    }
  });
});
