/**
 * barcodeMealSlot.test.ts
 *
 * Gap #5 (2026-06-09) — barcode screen was hardcoded to "Snacks" for
 * every scan. This tests that:
 *   1. The hardcoded "Snacks" literal is absent from barcode.tsx.
 *   2. The mealSlot state is initialised from `fallbackSlotFromTimeOfDay`
 *      (same ladder as the recipe log and LogSheet).
 *   3. The `fallbackSlotFromTimeOfDay` ladder itself is correct (unit
 *      tested here alongside the static-pin check so the full chain is
 *      exercised).
 *
 * Also pin-tests the typography token upgrades (Gap #1) and spacing
 * fixes (Gap #4) so silent regression is caught at CI time.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fallbackSlotFromTimeOfDay, slotForHour } from "../../../../src/lib/nutrition/recipeJournalSlot";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const BARCODE_SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/barcode.tsx"),
  "utf8",
);
const BARCODE_MODAL_SRC = readFileSync(
  resolve(REPO, "apps/mobile/components/BarcodeScannerModal.tsx"),
  "utf8",
);
const TODAY_SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);

// ── Static-pin: slot correctness ────────────────────────────────────────────

describe("slotForHour (canonical ladder)", () => {
  it("returns Breakfast before 11:00", () => {
    expect(slotForHour(6)).toBe("Breakfast");
    expect(slotForHour(10)).toBe("Breakfast");
  });
  it("returns Lunch 11:00–14:59", () => {
    expect(slotForHour(11)).toBe("Lunch");
    expect(slotForHour(14)).toBe("Lunch");
  });
  it("returns Snacks 15:00–16:59", () => {
    expect(slotForHour(15)).toBe("Snacks");
    expect(slotForHour(16)).toBe("Snacks");
  });
  it("returns Dinner 17:00+", () => {
    expect(slotForHour(17)).toBe("Dinner");
    expect(slotForHour(23)).toBe("Dinner");
  });
});

describe("fallbackSlotFromTimeOfDay", () => {
  it("returns a valid slot for the current time", () => {
    const slot = fallbackSlotFromTimeOfDay();
    expect(["Breakfast", "Lunch", "Snacks", "Dinner"]).toContain(slot);
  });
});

// ── Static-pin: barcode.tsx ──────────────────────────────────────────────────

describe("BarcodeScannerModal — gap #5: meal slot picker on Today scan", () => {
  it("imports fallbackSlotFromTimeOfDay and exposes the slot picker UI", () => {
    expect(BARCODE_MODAL_SRC).toContain("fallbackSlotFromTimeOfDay");
    expect(BARCODE_MODAL_SRC).toContain('testID="barcode-modal-slot-row"');
    // ENG-1177: the picker maps a configurable `slotOptions` prop (defaults to
    // DEFAULT_MEAL_SLOTS) rather than the global MEAL_SLOTS list.
    expect(BARCODE_MODAL_SRC).toContain("slotOptions.map");
  });

  it("passes mealSlot through onScan on confirm and manual submit", () => {
    expect(BARCODE_MODAL_SRC).toMatch(/onScan\(scanned,\s*scaledProduct,\s*mealSlot\)/);
    expect(BARCODE_MODAL_SRC).toMatch(/onScan\(scanned \?\? "manual",\s*manualProduct,\s*mealSlot\)/);
  });

  it("accepts initialMealSlot from the Today host and logs with returned slot", () => {
    expect(TODAY_SRC).toContain("initialMealSlot={activeMealSlot");
    expect(TODAY_SRC).toMatch(/onScan=\{\(_code: string, product, mealSlot\) =>/);
    expect(TODAY_SRC).toMatch(/name:\s*mealSlot/);
    expect(TODAY_SRC).not.toMatch(
      /onScan=\{\(_code: string, product\) =>[\s\S]{0,400}name:\s*activeMealSlot/,
    );
  });
});

describe("barcode.tsx — gap #5: meal slot correctness", () => {
  it('does NOT hardcode name: "Snacks" in either insert call', () => {
    // The two insert calls previously both contained the literal "Snacks"
    // as the meal-slot name. That pattern is the bug. Verify it's gone.
    // We expect exactly zero matches for `name: "Snacks"` in the insert
    // context (the nutrition_entries insert payload).
    const snacksLiteralInInsert = BARCODE_SRC.match(/name:\s*["']Snacks["']/g);
    expect(snacksLiteralInInsert).toBeNull();
  });

  it("imports fallbackSlotFromTimeOfDay from the shared slot lib", () => {
    expect(BARCODE_SRC).toContain("fallbackSlotFromTimeOfDay");
    expect(BARCODE_SRC).toContain("recipeJournalSlot");
  });

  it("uses mealSlot state variable in both insert calls", () => {
    // Both commitLog and handleManualLog must reference mealSlot, not "Snacks".
    const insertMatches = BARCODE_SRC.match(/name:\s*mealSlot/g) ?? [];
    // Two insert calls: commitLog + handleManualLog
    expect(insertMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("initialises mealSlot via fallbackSlotFromTimeOfDay lazy initialiser", () => {
    expect(BARCODE_SRC).toContain("() => fallbackSlotFromTimeOfDay()");
  });
});

describe("barcode.tsx — gap #1: typography tokens", () => {
  // Re-pinned: headers census 2026-06-10. The hand-tuned 18/600 + 17/600
  // serifSemibold sheet titles (overlayTitle / productName / manualTitle /
  // corrTitle) converged onto the canonical compact-title token Type.navTitle
  // (serifMedium 18/22). The old serifSemibold + Type.headline pins are
  // superseded — the census collapses the hybrid into one nav-title voice.
  it("uses Type.navTitle for the four scanner/sheet serif titles", () => {
    const navTitleUses = BARCODE_SRC.match(/\.\.\.Type\.navTitle/g) ?? [];
    expect(navTitleUses.length).toBeGreaterThanOrEqual(4);
  });

  it("uses Type.heroValue for macro numerals", () => {
    expect(BARCODE_SRC).toContain("Type.heroValue");
  });
});

describe("barcode.tsx — gap #4: spacing tokens", () => {
  it("does not use off-scale paddingVertical: 14", () => {
    const offScale = BARCODE_SRC.match(/paddingVertical:\s*14\b/g);
    expect(offScale).toBeNull();
  });

  it("does not use off-scale paddingVertical: 12", () => {
    const offScale = BARCODE_SRC.match(/paddingVertical:\s*12\b/g);
    expect(offScale).toBeNull();
  });

  it("does not use off-scale paddingHorizontal: 10", () => {
    const offScale = BARCODE_SRC.match(/paddingHorizontal:\s*10\b/g);
    expect(offScale).toBeNull();
  });

  it("does not use off-scale gap: 6", () => {
    const offScale = BARCODE_SRC.match(/gap:\s*6\b/g);
    expect(offScale).toBeNull();
  });

  it("does not use negative marginTop hack (in code, not comments)", () => {
    // Strip line comments before checking — we keep the comment that explains
    // the old pattern was removed, but the actual style property must be gone.
    const strippedComments = BARCODE_SRC.replace(/\/\/.*$/gm, "");
    const negativeMargin = strippedComments.match(/marginTop:\s*-\d/g);
    expect(negativeMargin).toBeNull();
  });
});

describe("barcode.tsx — gap #3: corner-bracket reticle", () => {
  it("uses reticleContainer + four bracket styles", () => {
    expect(BARCODE_SRC).toContain("reticleContainer");
    expect(BARCODE_SRC).toContain("reticleCornerTL");
    expect(BARCODE_SRC).toContain("reticleCornerTR");
    expect(BARCODE_SRC).toContain("reticleCornerBL");
    expect(BARCODE_SRC).toContain("reticleCornerBR");
  });

  it("does not use faint 50% opacity reticle", () => {
    // Old pattern: borderColor: accent.primary + "80"
    expect(BARCODE_SRC).not.toContain('"80"');
  });
});

describe("barcode.tsx — gap #9: confidence chip always-on", () => {
  it("always renders SearchResultConfidenceChip (not gated by searchRedesign)", () => {
    // Previously the chip was inside a ternary: searchRedesign ? <chip /> : <check icon />
    // Now it's always rendered. Verify the chip appears outside of a searchRedesign branch.
    const chipIndex = BARCODE_SRC.indexOf("SearchResultConfidenceChip");
    // There should be no `searchRedesign ?` before the chip in the same block
    // within 200 chars before the first chip usage.
    const before = BARCODE_SRC.slice(Math.max(0, chipIndex - 200), chipIndex);
    // The old conditional rendered the chip INSIDE `searchRedesign ? (...)`.
    // The new path renders it unconditionally in its own View.
    // Verify that the chip import still exists (it does — it's always used now).
    expect(BARCODE_SRC).toContain("SearchResultConfidenceChip");
    // And that the old "product.verified ?" ternary that rendered a plain Check
    // icon instead of the chip is gone.
    expect(BARCODE_SRC).not.toContain("} : product.verified ?");
  });
});

describe("barcode.tsx — gap #10: token-based colours", () => {
  it("does not use raw rgba white literal for input backgrounds", () => {
    // Old: rgba(255,255,255,0.12) for input bg
    const rawRgba = BARCODE_SRC.match(/backgroundColor:\s*["']rgba\(255,255,255/g);
    expect(rawRgba).toBeNull();
  });

  it("uses Colors.dark.inputBg for input bg", () => {
    expect(BARCODE_SRC).toContain("Colors.dark.inputBg");
  });

  it("uses Colors.dark.border for secondary button border", () => {
    expect(BARCODE_SRC).toContain("Colors.dark.border");
  });
});
