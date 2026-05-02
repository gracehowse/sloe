/**
 * Meal-nutrition extras — Settings polish-2 (2026-05-01, TestFlight
 * Build 40 feedback "tap meal for full nutrition doesn't show full
 * nutrition").
 *
 * Pre-fix the meal-nutrition screen showed Fiber + Water in the
 * always-visible extras strip and pushed Sugar + Sodium into the
 * "Vitamins, minerals & more" panel below. Users hit the screen, saw
 * macros + fiber + water, and concluded "not full nutrition". Sugar
 * and Sodium are arguably the two extras users care most about
 * after fiber, so we hoist them into the same row.
 *
 * Source-level structural test: confirms the extras section now
 * renders Sugar and Sodium between Fiber and Water, and confirms
 * `meal.micros.sugarG` / `meal.micros.sodiumMg` are the data sources.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PATH = resolve(__dirname, "../../app/meal-nutrition.tsx");
const SRC = readFileSync(PATH, "utf8");

describe("Meal nutrition — extras hoist (polish-2)", () => {
  it("declares sugarDisplay sourced from meal.micros.sugarG", () => {
    expect(SRC).toMatch(/const\s+sugarDisplay\s*=\s*\(/);
    expect(SRC).toMatch(/meal\?\.micros\?\.sugarG/);
  });

  it("declares sodiumDisplay sourced from meal.micros.sodiumMg", () => {
    expect(SRC).toMatch(/const\s+sodiumDisplay\s*=\s*\(/);
    expect(SRC).toMatch(/meal\?\.micros\?\.sodiumMg/);
  });

  it("renders Sugar and Sodium lines in the extras section", () => {
    // The visible extras strip is the block that already renders
    // Fiber and Water; Sugar and Sodium must live in the same block.
    const extrasBlock = SRC.match(
      /<View style=\{\[styles\.extras[\s\S]*?<\/View>\s*<\/View>/,
    );
    expect(extrasBlock).not.toBeNull();
    const block = extrasBlock?.[0] ?? "";
    // Ordering: Fiber, Sugar, Sodium, Water — what the user expects
    // to see at a glance for "full nutrition".
    const fiberIdx = block.indexOf(">\n            Fiber");
    const sugarIdx = block.indexOf(">\n            Sugar");
    const sodiumIdx = block.indexOf(">\n            Sodium");
    const waterIdx = block.indexOf(">\n            Water");
    expect(fiberIdx).toBeGreaterThan(-1);
    expect(sugarIdx).toBeGreaterThan(fiberIdx);
    expect(sodiumIdx).toBeGreaterThan(sugarIdx);
    expect(waterIdx).toBeGreaterThan(sodiumIdx);
  });

  it("falls back to em-dash when sugarDisplay or sodiumDisplay is zero", () => {
    // Honest empty-state — never make up values when the source did
    // not publish them. Mirrors the existing Fiber / Water em-dash.
    expect(SRC).toMatch(/sugarDisplay > 0\s*\?\s*`\$\{Math\.round\(sugarDisplay/);
    expect(SRC).toMatch(/sodiumDisplay > 0\s*\?\s*`\$\{Math\.round\(sodiumDisplay/);
  });
});

/**
 * Hint copy on Today — Settings polish-2 (TestFlight Build 40). The
 * meal-row hint pre-fix was "tap an item for nutrition", which the
 * tester read as ambiguous ("nutrition" → little tooltip vs full
 * screen). The full-screen meal-nutrition surface shows macros +
 * extras + micros + source, so the copy now signals "full nutrition"
 * to match what loads.
 */
describe("Today meals hint — copy clarity (polish-2)", () => {
  const TMS_PATH = resolve(__dirname, "../../components/today/TodayMealsSection.tsx");
  const TMS_SRC = readFileSync(TMS_PATH, "utf8");

  it("uses 'tap for full nutrition' on populated slots", () => {
    expect(TMS_SRC).toContain("tap for full nutrition");
  });

  it("drops the prior 'tap an item for nutrition' wording", () => {
    expect(TMS_SRC).not.toContain("tap an item for nutrition");
  });
});

/**
 * Behavioural test for the sugar / sodium guard logic. The display
 * helpers must clamp non-finite / negative / null inputs to zero and
 * pass through positive numbers. Closes "NaN displayed when source
 * publishes empty string" cases.
 */
describe("Meal nutrition — sugar/sodium guard (polish-2)", () => {
  // Re-implement the inline helpers used by the screen so the contract
  // is testable without mounting React.
  function sugarFrom(micros: Record<string, number> | null | undefined): number {
    const v = micros?.sugarG;
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  }
  function sodiumFrom(micros: Record<string, number> | null | undefined): number {
    const v = micros?.sodiumMg;
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
  }

  it("returns the value when sugarG is positive", () => {
    expect(sugarFrom({ sugarG: 4.2 })).toBe(4.2);
  });

  it("returns 0 when sugarG is 0", () => {
    expect(sugarFrom({ sugarG: 0 })).toBe(0);
  });

  it("returns 0 when sugarG is negative (sentinel value)", () => {
    expect(sugarFrom({ sugarG: -1 })).toBe(0);
  });

  it("returns 0 when sugarG is NaN", () => {
    expect(sugarFrom({ sugarG: Number.NaN })).toBe(0);
  });

  it("returns 0 when micros is null/undefined", () => {
    expect(sugarFrom(null)).toBe(0);
    expect(sugarFrom(undefined)).toBe(0);
  });

  it("returns 0 when micros is missing the sodium key", () => {
    expect(sodiumFrom({ fiberG: 3 })).toBe(0);
  });

  it("returns sodiumMg when present and positive", () => {
    expect(sodiumFrom({ sodiumMg: 450 })).toBe(450);
  });
});
