import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-821 (Redesign — Design Direction 2026) — recipe edit + ingredient editor
 * dialog token sweep (web lane).
 *
 * The design-director review read the web edit + ingredient dialogs as
 * "imported from a different design system": they sat on a pure-white
 * `bg-card` (#fff) surface with a hairline border standing in for depth,
 * against the product's warm-oat (`--background: #F3F0E8`) canvas. The three
 * dialogs now unconditionally sit on the warm `bg-background` surface and let
 * the real soft `--elev-card-soft` shadow carry separation (no border). The
 * `design_system_elevation` flag has been collapsed (ENG-1651) — the flag was
 * permanently ON and the old white/hairline path has been removed from
 * source entirely, so this sweep pins the flag's ABSENCE rather than its
 * presence (mirrors `settingsElevationFlag.test.ts`,
 * `adherenceOverDisplayWiring.test.ts`).
 *
 * Source-assertion style (mirrors `recipeEditWebParity.test.ts`) so the sweep
 * can't silently regress.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const DIALOGS = [
  ["recipe-edit-dialog", "../../src/app/components/suppr/recipe-edit-dialog.tsx"],
  ["override-ingredient-dialog", "../../src/app/components/suppr/override-ingredient-dialog.tsx"],
  ["add-ingredient-dialog", "../../src/app/components/suppr/add-ingredient-dialog.tsx"],
] as const;

describe("ENG-821 — recipe/ingredient editor dialogs token sweep (web)", () => {
  for (const [name, rel] of DIALOGS) {
    describe(name, () => {
      const src = () => read(rel);

      it("does not gate the surface behind design_system_elevation (flag collapsed, ENG-1651)", () => {
        const s = src();
        expect(s).not.toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
        // unconditionally warm cream + soft shadow — no flag-OFF white/hairline path remains.
        expect(s).toMatch(/bg-background[^"]*shadow-\[var\(--elev-card-soft\)\]/);
      });

      it("surface drops the border-as-depth", () => {
        expect(src()).toMatch(/bg-background border-transparent/);
      });
    });
  }

  it("recipe-edit dialog keeps shared recipeEdit helpers + the blue default Save CTA", () => {
    const s = read("../../src/app/components/suppr/recipe-edit-dialog.tsx");
    // sweep must not disturb the existing persistence wiring.
    expect(s).toMatch(/buildRecipeMetadataUpdate/);
    expect(s).toMatch(/recomputeRecipeAggregate/);
    // the commit CTA is the default Button (blue bg-primary-solid) — no green
    // fill to repaint here, so no design_system_colours gate is needed.
    expect(s).not.toMatch(/bg-success/);
  });
});
