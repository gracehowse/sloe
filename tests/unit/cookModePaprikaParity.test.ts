/**
 * Web CookMode — Paprika parity (2026-04-30) source-structure tests.
 *
 * Mirror of `apps/mobile/tests/unit/cookCompletionPolish.test.ts` but
 * for the web `src/app/components/CookMode.tsx` surface. Source-level
 * assertions verify the parity guarantees the spec calls out:
 *
 *   - Recipe scaling control wired to the shared helper (no
 *     reinvented regex on the web side).
 *   - Notes + rating + Save flow wired to recipe_cook_history via the
 *     shared client (single source of truth for both platforms).
 *   - "Last time" card surfaces history rows pulled by the same
 *     listRecentCookHistory helper as mobile.
 *
 * Behaviour-level RTL tests against the rendered surface are deferred
 * to qa-lead — the existing CookMode tests use source-level checks
 * for the same reason (the JSX depends on a real `useAppData` provider
 * + Supabase client we'd need to mock).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK_MODE_PATH = resolve(__dirname, "../../src/app/components/CookMode.tsx");
const SOURCE = readFileSync(COOK_MODE_PATH, "utf8");

describe("Web CookMode — recipe scaling source structure", () => {
  it("imports the shared scaleStepText helper + Paprika COOK_SCALE_PRESETS (parity with mobile)", () => {
    // Servings handoff (P0, 2026-05-01): step-text scaling moved off
    // the Paprika-only `scaleAmountText` and onto `scaleStepText`,
    // which composes the recipe-page-stepper scale factor with the
    // Paprika preset scale. The Paprika preset state is preserved.
    expect(SOURCE).toMatch(
      /COOK_SCALE_PRESETS[^;]*from\s+["'][^"']+recipeScale\.ts?["']/,
    );
    expect(SOURCE).toMatch(
      /scaleStepText[^;]*from\s+["'][^"']+scaleStepText[^"']*["']/,
    );
    expect(SOURCE).toMatch(/cookScaleStorageKey/);
    expect(SOURCE).toMatch(/cookScaleCaption/);
  });
  it("renders a 5-preset segmented control wired to handleScaleChange", () => {
    expect(SOURCE).toMatch(/COOK_SCALE_PRESETS\.map/);
    expect(SOURCE).toMatch(/handleScaleChange/);
    // ARIA: radiogroup + radio + aria-checked from the active state.
    expect(SOURCE).toMatch(/role="radiogroup"/);
    expect(SOURCE).toMatch(/role="radio"/);
    expect(SOURCE).toMatch(/aria-checked=\{active\}/);
  });
  it("rewrites step text via scaleStepText (composing servings-handoff + Paprika scale)", () => {
    expect(SOURCE).toMatch(
      /scaleStepText\(\s*cleanStepText\(\s*currentStepRaw\s*\)\s*,\s*scaleFactor\s*\)/,
    );
    expect(SOURCE).toMatch(/parseTimersInStep\(currentStepCleaned\)/);
  });
  it("emits recipe_scale_changed analytics on commit", () => {
    expect(SOURCE).toMatch(/AnalyticsEvents\.recipe_scale_changed/);
  });
  it("logs via commitLogMeal with servings eaten (ENG-1129) and legacy 1-serving fallback", () => {
    // ENG-1129: primary path asks how many servings were eaten and
    // passes that count to `commitLogMeal`. Legacy (flag off) logs 1
    // serving — Paprika batch scale affects step text, not auto-log kcal.
    expect(SOURCE).toMatch(/commitLogMeal/);
    expect(SOURCE).toMatch(/servingsToLog/);
    expect(SOURCE).toMatch(/portionMultiplier:\s*servingsToLog/);
    expect(SOURCE).toMatch(/commitLogMeal\(servingsEaten\)/);
    expect(SOURCE).toMatch(/commitLogMeal\(1\)/);
    expect(SOURCE).toMatch(
      /scaleFactor\s*=[\s\S]{0,120}servings\s*\/\s*effectiveBaseServings[\s\S]{0,40}\*\s*scale/,
    );
  });
});

describe("Web CookMode — per-cook history persistence source structure", () => {
  it("imports the shared recipeCookHistoryClient (single-source-of-truth)", () => {
    expect(SOURCE).toMatch(
      /insertCookHistory[^;]*from\s+["'][^"']+recipeCookHistoryClient\.ts?["']/,
    );
    expect(SOURCE).toMatch(/listRecentCookHistory/);
    expect(SOURCE).toMatch(/formatCookHistoryPreview/);
  });
  it("renders the 'Last time' card from recentHistory state", () => {
    expect(SOURCE).toMatch(/recentHistory/);
    expect(SOURCE).toMatch(/Last time/);
  });
  it("renders a 5-star rating row that sets local state", () => {
    expect(SOURCE).toMatch(/\[1,\s*2,\s*3,\s*4,\s*5\]/);
    expect(SOURCE).toMatch(/setRating/);
  });
  it("renders a notes textarea bound to noteDraft (capped at the shared constant)", () => {
    expect(SOURCE).toMatch(/Notes for next time \(optional\)/);
    expect(SOURCE).toMatch(/maxLength=\{COOK_HISTORY_NOTE_MAX_LEN\}/);
  });
  it("renders a Save button wired to handleSaveHistory", () => {
    expect(SOURCE).toMatch(/handleSaveHistory/);
    expect(SOURCE).toMatch(/Save this cook/);
  });
  it("emits cook_history_saved analytics after the row writes", () => {
    expect(SOURCE).toMatch(/AnalyticsEvents\.cook_history_saved/);
  });
  it("captures cook duration on the goNext finish transition", () => {
    expect(SOURCE).toMatch(/sessionStartRef\.current/);
    expect(SOURCE).toMatch(/setCookDurationSec/);
  });
});
