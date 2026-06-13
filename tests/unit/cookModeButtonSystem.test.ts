/**
 * Cook mode (WEB) — SOLID-PRIMARY / GHOST button system
 * (cohesion wave 2026-06-13, ENG-1080;
 * `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The Cook-mode CTAs — the step-nav "Next/Finish", "Log this meal", and
 * "Save this cook" — are the in-recipe equivalent of the Plan/Today
 * generate/log/secondary trio, and the canon says they ride the same
 * `SupprButton` grammar:
 *   - PRIMARY (Next/Finish step-nav + "Log this meal") → `variant="primary"`:
 *     SOLID `bg-primary-solid` fill, white sans label, full pill, no border.
 *   - SECONDARY ("Save this cook") → `variant="ghost"`: transparent, no border.
 *
 * These are static-source pins (the component owns a fixed-overlay cook
 * surface with a WakeLock + AudioContext that isn't cheap to render here).
 * They break the moment a cook CTA regresses to an ad-hoc filled button
 * (`bg-primary text-primary-foreground font-semibold`) or the retired
 * aubergine OUTLINE pill (`border border-primary/40`), or drops the
 * SupprButton import.
 *
 * Mobile parity is pinned by `apps/mobile/tests/unit/cookModeButtonSystem.test.ts`
 * against `apps/mobile/app/cook.tsx` (Next Step / Log this meal = primary,
 * Save this cook = ghost).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const COOK = read("src/app/components/CookMode.tsx");

// Retired treatments the migration drained: the ad-hoc solid filled button
// and the aubergine outline pill. Neither may resurface on a cook CTA.
const ADHOC_FILLED_BTN = /bg-primary\s+text-primary-foreground\s+font-semibold/;
const OUTLINE_PILL = /border\s+border-primary\/40/;

describe("CookMode CTAs — solid primary / ghost (cohesion wave 2026-06-13)", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(COOK).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("step-nav 'Next/Finish' is a SOLID primary SupprButton", () => {
    // The verb flips (Finish on the last step, Next otherwise); pin the
    // primary wrapping the goNext advance.
    expect(COOK).toMatch(
      /<SupprButton\s+variant="primary"\s+type="button"\s+onClick=\{goNext\}[\s\S]{0,160}isLastStep \? "Finish" : "Next"/,
    );
  });

  it("'Log this meal' is a SOLID primary SupprButton (the done state's ONE solid CTA)", () => {
    expect(COOK).toMatch(
      /<SupprButton\s+variant="primary"\s+type="button"\s+onClick=\{handleLogMeal\}[\s\S]{0,200}Log this meal/,
    );
  });

  it("'Save this cook' is a GHOST SupprButton (secondary), with loading + saved-disable wiring", () => {
    expect(COOK).toMatch(
      /<SupprButton\s+variant="ghost"\s+type="button"\s+onClick=\{\(\) => void handleSaveHistory\(\)\}[\s\S]{0,200}Save this cook/,
    );
    // The async commit keeps the in-flight loading + idempotent disable so a
    // double-tap can't write two cook-history rows.
    expect(COOK).toMatch(
      /onClick=\{\(\) => void handleSaveHistory\(\)\}[\s\S]{0,120}loading=\{savingHistory\}[\s\S]{0,80}disabled=\{historySaved \|\| savingHistory\}/,
    );
  });

  it("done-card 'Back to recipe' dismiss is a GHOST SupprButton (parity with mobile)", () => {
    // Was a hand-rolled muted <button> — migrated to ghost so the same logical
    // completion-card dismiss rides the shared primitive on both platforms. The
    // sanctioned exit is the header "Exit Cook Mode" icon, not this card CTA.
    expect(COOK).toMatch(
      /<SupprButton\s+variant="ghost"\s+type="button"\s+onClick=\{onExit\}[\s\S]{0,80}Back to recipe/,
    );
  });

  it("no Cook CTA regresses to the ad-hoc filled button or the retired outline pill", () => {
    expect(COOK).not.toMatch(ADHOC_FILLED_BTN);
    expect(COOK).not.toMatch(OUTLINE_PILL);
  });
});
