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
  it("imports the shared scaleAmountText / COOK_SCALE_PRESETS helpers (parity with mobile)", () => {
    expect(SOURCE).toMatch(
      /COOK_SCALE_PRESETS[^;]*from\s+["'][^"']+recipeScale\.ts?["']/,
    );
    expect(SOURCE).toMatch(/\bscaleAmountText\b/);
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
  it("rewrites step text via scaleAmountText (parser stays on cleaned)", () => {
    expect(SOURCE).toMatch(/scaleAmountText\(currentStepCleaned,\s*scale\)/);
    expect(SOURCE).toMatch(/parseTimersInStep\(currentStepCleaned\)/);
  });
  it("emits recipe_scale_changed analytics on commit", () => {
    expect(SOURCE).toMatch(/AnalyticsEvents\.recipe_scale_changed/);
  });
  it("includes scale in the Log this meal portionMultiplier", () => {
    // The journal entry's `portionMultiplier` already combines
    // `servings / baseServings`; multiplying by `scale` ensures the
    // entry reflects the cooked-as-scaled portion.
    expect(SOURCE).toMatch(/servings\s*\/\s*baseServings\)\s*\*\s*scale/);
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
