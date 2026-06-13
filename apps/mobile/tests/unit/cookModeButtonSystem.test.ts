/**
 * Cook mode (MOBILE) — SOLID-PRIMARY / GHOST button system
 * (cohesion wave 2026-06-13, ENG-1080;
 * `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The Cook-screen CTAs ride the shared `SupprButton` grammar, parity with the
 * web `CookMode.tsx` lane:
 *   - PRIMARY (step-nav "Next Step / Done!" + "Log this meal") →
 *     `variant="primary"`: solid aubergine fill, white sans label.
 *   - SECONDARY ("Save this cook") → `variant="ghost"`: transparent, no border.
 *
 * The hand-rolled filled `nextBtn`/`doneBtn`/`saveBtn` Pressables are gone:
 *   - `nextBtn` no longer exists as a style key at all (the nav CTA is a bare
 *     `SupprButton variant="primary"`).
 *   - `doneBtn` / `saveBtn` survive ONLY as layout-only overrides on the
 *     primitive (margin / gap) — no `backgroundColor` / `borderWidth` /
 *     `borderColor` fill of their own, so a revert to an ad-hoc filled button
 *     is caught here.
 *
 * Static-source pins (the screen is a ~1.6k-line RN file with a WakeLock +
 * Supabase + AsyncStorage surface that isn't cheap to render here). Mirrors the
 * style of `tests/unit/planSummaryCtaButtonSystem.test.ts`. Web parity is owned
 * by `tests/unit/cookModeButtonSystem.test.ts` (web lane), not asserted here.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK_PATH = resolve(__dirname, "../../app/cook.tsx");
const MOBILE_SRC = readFileSync(COOK_PATH, "utf8");

/** Slice a window of source around the first occurrence of `needle`. */
function around(needle: string, before = 260, after = 60): string {
  const idx = MOBILE_SRC.indexOf(needle);
  expect(idx).toBeGreaterThan(-1);
  return MOBILE_SRC.slice(idx - before, idx + needle.length + after);
}

describe("Cook screen CTAs — button system migration (ENG-1080)", () => {
  it("imports the shared SupprButton primitive", () => {
    expect(MOBILE_SRC).toContain(
      'import { SupprButton } from "@/components/ui/SupprButton"',
    );
  });

  it("step-nav 'Next Step / Done!' is a solid SupprButton primary", () => {
    // The nav CTA is a bare primary SupprButton — its label flips with the
    // step. Pin the primary wrapping the label expression.
    const block = around('label={current === totalSteps - 1 ? "Done!" : "Next Step"}');
    expect(block).toContain('variant="primary"');
  });

  it("'Log this meal' is a solid SupprButton primary (the done state's ONE solid CTA)", () => {
    // The CTA's onPress carries a multi-line router.replace body, so widen the
    // back-window to reach the opening tag from the `label` prop.
    const block = around('label="Log this meal"', 900, 60);
    expect(block).toContain('variant="primary"');
    // Keeps its layout-only `doneBtn` override (margin off the card).
    expect(block).toContain("style={styles.doneBtn}");
  });

  it("'Save this cook' is a SupprButton ghost (secondary), with loading + saved-disable wiring", () => {
    const idx = MOBILE_SRC.indexOf("handleSaveHistory()");
    expect(idx).toBeGreaterThan(-1);
    const block = MOBILE_SRC.slice(idx - 200, idx + 320);
    expect(block).toContain('variant="ghost"');
    // Async commit blocks the double-write: loading while saving, disabled once saved.
    expect(block).toContain("loading={savingHistory}");
    expect(block).toContain("disabled={historySaved}");
  });

  it("the hand-rolled filled 'nextBtn' style is gone (nav CTA is a bare SupprButton primary)", () => {
    expect(MOBILE_SRC).not.toContain("nextBtn:");
  });

  it("'doneBtn' / 'saveBtn' survive only as layout-only overrides — no ad-hoc fill or border", () => {
    // doneBtn: margin off the card only — solid fill comes from the primitive.
    const doneStart = MOBILE_SRC.indexOf("doneBtn: {");
    const doneEnd = MOBILE_SRC.indexOf("}", doneStart);
    expect(doneStart).toBeGreaterThan(-1);
    const doneBlock = MOBILE_SRC.slice(doneStart, doneEnd);
    expect(doneBlock).not.toContain("backgroundColor");
    expect(doneBlock).not.toContain("borderWidth");
    expect(doneBlock).not.toContain("borderColor");

    // saveBtn: gap only — ghost fill (transparent, no border) comes from the primitive.
    const saveStart = MOBILE_SRC.indexOf("saveBtn: {");
    const saveEnd = MOBILE_SRC.indexOf("}", saveStart);
    expect(saveStart).toBeGreaterThan(-1);
    const saveBlock = MOBILE_SRC.slice(saveStart, saveEnd);
    expect(saveBlock).not.toContain("backgroundColor");
    expect(saveBlock).not.toContain("borderWidth");
    expect(saveBlock).not.toContain("borderColor");
  });
});
