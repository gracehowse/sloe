/**
 * Redesign P5 parity — cluster C5 (gaps #19, #20, #21).
 *
 * Originally three web↔mobile parity fixes on the log-sheet + add-meal
 * surfaces, each gated behind a redesign flag with the OLD path alive in the
 * `else` (CLAUDE.md feature-flag non-negotiable). `design_system_elevation`
 * has since collapsed (ENG-1651 — it was permanently ON via
 * `REDESIGN_DEFAULT_ON`, so the gate + OFF paths were deleted and the ON
 * behaviour ships unconditionally):
 *
 *   #19  log-sheet.tsx — the sheet shadow was a hardcoded LIGHT-only literal
 *        (`0 -8px 32px rgba(0,0,0,0.12)`). It now unconditionally reads the
 *        canonical `--elev-sheet` token (no-op in light, the deeper dark
 *        variant in dark) matching mobile `Elevation.sheet`. No flag, no
 *        hardcoded-literal fallback.
 *
 *   #20  today-add-meal-dialog.tsx — the only suppr dialog never swept onto
 *        `design_system_elevation`. Now unconditionally mirrors the three
 *        sibling dialogs (recipe-edit / add-ingredient / override-ingredient):
 *        the warm `bg-background` surface + `--elev-card-soft` shadow with no
 *        border. No flag, no legacy white `bg-card` + hairline fallback.
 *
 *   #21  log-sheet.tsx — the `redesign_motion` element→sheet open morph via the
 *        shared `sheetTransition(open)` web analog, with the existing
 *        premiumMotion slide as the flag-OFF else. `redesign_motion` is
 *        untouched by the ENG-1651 collapse — still gated.
 *
 * The token/structural assertions read source (mirrors
 * `recipeEditDialogTokenSweep.test.ts` / `settingsElevationFlag.test.ts`,
 * which pin a collapsed flag's ABSENCE from source rather than its presence);
 * the dialog's unconditional render is verified live so the styling can't
 * silently regress.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Ensure JSX runtime finds React under vitest/jsdom.
void React;

const ROOT = resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const LOG_SHEET = "src/app/components/suppr/log-sheet.tsx";
const ADD_MEAL = "src/app/components/suppr/today-add-meal-dialog.tsx";
const THEME = "src/styles/theme.css";

describe("C5 — log-sheet sheet shadow token (#19)", () => {
  const src = () => read(LOG_SHEET);

  it("no longer gates the sheet shadow on design_system_elevation (ENG-1651 collapse)", () => {
    expect(src()).not.toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
  });

  it("unconditionally reads the canonical --elev-sheet token (light+dark parity with mobile Elevation.sheet)", () => {
    expect(src()).toContain("shadow-[var(--elev-sheet)]");
  });

  it("the --elev-sheet token is declared (and branches) in theme.css", () => {
    const css = read(THEME);
    // light + dark variants both present.
    const matches = css.match(/--elev-sheet:/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("C5 — log-sheet redesign_motion morph (#21)", () => {
  const src = () => read(LOG_SHEET);

  it("gates the morph on redesign_motion", () => {
    expect(src()).toMatch(/isFeatureEnabled\("redesign_motion"\)/);
  });

  it("uses the shared sheetTransition(open) web analog (no bespoke spring math)", () => {
    const s = src();
    expect(s).toMatch(/import\s*\{\s*sheetTransition\s*\}\s*from\s*"@\/lib\/motion"/);
    expect(s).toContain("sheetTransition(open)");
  });

  it("keeps the existing premiumMotion slide alive as the flag-OFF else", () => {
    const s = src();
    expect(s).toContain("isPremiumMotionV1Enabled()");
    // The legacy vaul slide animation classes must still be present (else path).
    expect(s).toContain("slide-in-from-bottom");
  });

  it("disables the vaul slide when the morph drives the entry (no double-motion)", () => {
    // The premiumMotion slide branch is suppressed while motion is enabled.
    expect(src()).toContain("!motionEnabled && premiumMotion");
  });
});

describe("C5 — today-add-meal-dialog elevation gating (#20)", () => {
  const src = () => read(ADD_MEAL);

  it("no longer gates the surface behind design_system_elevation (ENG-1651 collapse, source)", () => {
    expect(src()).not.toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
  });

  it("unconditionally uses the warm bg-background + soft shadow, no border (source)", () => {
    expect(src()).toMatch(/bg-background border-transparent shadow-\[var\(--elev-card-soft\)\]/);
  });
});

/* -------------------------------------------------------------------------- */
/* Live render: the dialog actually applies the unconditional surface class.  */
/* -------------------------------------------------------------------------- */

vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: () => false,
  track: () => {},
}));

async function renderAddMeal() {
  const { TodayAddMealDialog } = await import(
    "../../src/app/components/suppr/today-add-meal-dialog"
  );
  render(
    <TodayAddMealDialog
      open
      onOpenChange={() => {}}
      selectedDate={new Date("2026-05-31T12:00:00Z")}
      mealSlot="Breakfast"
      onMealSlotChange={() => {}}
      addMode="recipe"
      onAddModeChange={() => {}}
      recipeId=""
      onRecipeIdChange={() => {}}
      recipeOptions={[]}
      savedRecipesEmpty
      recipePortionMultiplier={1}
      onRecipePortionMultiplierChange={() => {}}
      manualName=""
      onManualNameChange={() => {}}
      manualCalories={0}
      onManualCaloriesChange={() => {}}
      manualProtein={0}
      onManualProteinChange={() => {}}
      manualCarbs={0}
      onManualCarbsChange={() => {}}
      manualFat={0}
      onManualFatChange={() => {}}
      manualFiber={0}
      onManualFiberChange={() => {}}
      manualWater={0}
      onManualWaterChange={() => {}}
      timeLabel="12:00 PM"
      onTimeLabelChange={() => {}}
      onSubmit={() => {}}
      onOpenSearch={() => {}}
    />,
  );
  return screen.getByTestId("today-add-meal-dialog");
}

describe("C5 — today-add-meal-dialog elevation gating (#20, live render)", () => {
  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  it("unconditionally renders the warm bg-background surface + soft shadow, no border", async () => {
    const dialog = await renderAddMeal();
    expect(dialog.className).toContain("bg-background");
    expect(dialog.className).toContain("border-transparent");
    expect(dialog.className).toContain("shadow-[var(--elev-card-soft)]");
    expect(dialog.className).not.toContain("border-border");
  });
});
