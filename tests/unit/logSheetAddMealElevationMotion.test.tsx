/**
 * Redesign P5 parity — cluster C5 (gaps #19, #20, #21).
 *
 * Three web↔mobile parity fixes on the log-sheet + add-meal surfaces, each
 * gated behind a redesign flag with the OLD path alive in the `else` (CLAUDE.md
 * feature-flag non-negotiable):
 *
 *   #19  log-sheet.tsx — the sheet shadow was a hardcoded LIGHT-only literal
 *        (`0 -8px 32px rgba(0,0,0,0.12)`). Under `design_system_elevation` it
 *        reads the canonical `--elev-sheet` token (no-op in light, the deeper
 *        dark variant in dark) matching mobile `Elevation.sheet`. The hardcoded
 *        literal stays alive in the flag-OFF else.
 *
 *   #20  today-add-meal-dialog.tsx — the only suppr dialog never swept onto
 *        `design_system_elevation`. Now mirrors the three sibling dialogs
 *        (recipe-edit / add-ingredient / override-ingredient): flag-ON moves
 *        to the warm `bg-background` surface + `--elev-card-soft` shadow with
 *        no border; flag-OFF keeps today's white `bg-card` + hairline.
 *
 *   #21  log-sheet.tsx — the `redesign_motion` element→sheet open morph via the
 *        shared `sheetTransition(open)` web analog, with the existing
 *        premiumMotion slide as the flag-OFF else.
 *
 * The token/structural assertions read source (mirrors
 * `recipeEditDialogTokenSweep.test.ts` / `settingsElevationFlag.test.ts`); the
 * dialog flag-ON render is verified live so the gating can't silently regress.
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

  it("gates the sheet shadow on design_system_elevation", () => {
    expect(src()).toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
  });

  it("flag-ON reads the canonical --elev-sheet token (light+dark parity with mobile Elevation.sheet)", () => {
    expect(src()).toContain("shadow-[var(--elev-sheet)]");
  });

  it("flag-OFF keeps the original hardcoded light literal alive in the else", () => {
    // The old always-on literal must survive ONLY as the flag-OFF fallback.
    expect(src()).toContain("shadow-[0_-8px_32px_rgba(0,0,0,0.12)]");
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

  it("gates the surface behind design_system_elevation (source)", () => {
    expect(src()).toMatch(/isFeatureEnabled\("design_system_elevation"\)/);
  });

  it("flag-ON surface uses warm bg-background + soft shadow, no border (source)", () => {
    expect(src()).toMatch(/bg-background border-transparent shadow-\[var\(--elev-card-soft\)\]/);
  });

  it("flag-OFF surface preserves today's white bg-card + hairline border (source)", () => {
    expect(src()).toContain("bg-card border-border");
  });
});

/* -------------------------------------------------------------------------- */
/* Live render: the dialog actually applies the gated surface class.          */
/* -------------------------------------------------------------------------- */

const flagState = { elevation: false };

vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (flag: string) =>
    flag === "design_system_elevation" ? flagState.elevation : false,
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

  it("flag-OFF renders the legacy white card + hairline border", async () => {
    flagState.elevation = false;
    const dialog = await renderAddMeal();
    expect(dialog.className).toContain("bg-card");
    expect(dialog.className).toContain("border-border");
    expect(dialog.className).not.toContain("shadow-[var(--elev-card-soft)]");
  });

  it("flag-ON renders the warm bg-background surface + soft shadow, no border", async () => {
    flagState.elevation = true;
    const dialog = await renderAddMeal();
    expect(dialog.className).toContain("bg-background");
    expect(dialog.className).toContain("border-transparent");
    expect(dialog.className).toContain("shadow-[var(--elev-card-soft)]");
    expect(dialog.className).not.toContain("border-border");
  });
});
