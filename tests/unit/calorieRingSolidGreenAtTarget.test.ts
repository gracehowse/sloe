/**
 * Three-state ring colour mapping (Grace 2026-05-05 audit feedback) —
 * structural-pin test for the calorie ring stroke logic on web + mobile.
 *
 * Supersedes the Build 41 two-state mapping (gradient-while-progressing,
 * solid-green-from-target-onward), which inverted the visual cue: a
 * user who'd gone OVER target saw a green ring while the centre digit
 * read destructive/warning, and a user who'd logged UNDER target saw
 * the welcome gradient as if they hadn't started yet.
 *
 * Three states the ring stroke must distinguish:
 *   1. Empty (consumed === 0) → brand gradient. "Welcome / haven't
 *      started yet."
 *   2. Logged-and-under (0 < consumed <= goal) → `Accent.success` /
 *      `var(--success)` solid green. "Logging, on track."
 *   3. Logged-and-over (consumed > goal) → `Accent.destructive` /
 *      `var(--destructive)` solid red. "Over budget." Matches the
 *      centre-digit colour, which already flips when over.
 *
 * This file pins the structural wiring on both platforms so a future
 * refactor that re-introduces always-gradient or two-state branching
 * fails CI. Source-grep style mirrors `foodSearchFatSecretMerge.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PATH = resolve(
  __dirname,
  "../../apps/mobile/components/charts/CalorieRing.tsx",
);
const WEB_PATH = resolve(
  __dirname,
  "../../src/app/components/suppr/daily-ring.tsx",
);

const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");

describe("Three-state ring — mobile CalorieRing", () => {
  // 2026-05-19 (Phase V1): stroke colours now route through two local
  // consts that fall back to `Accent.destructive` / `Accent.success`
  // when the Tare preview / flag is off, and to softened Tare tokens
  // when it's on. The three-state semantic guarantee (empty=gradient,
  // over=red, under=green when Tare off) is preserved by pinning BOTH
  // (a) the stroke ternary uses the named consts, AND
  // (b) the consts resolve to the legacy Accent values when tare is null.
  // A future refactor that reverts to always-gradient or breaks the
  // three-state branching fails one of these pins.
  it("empty → gradient, over → overBudgetStroke, under → underBudgetStroke", () => {
    expect(MOBILE_SRC).toMatch(
      /stroke=\{[\s\S]*?isEmpty[\s\S]*?\?\s*"url\(#calorie-ring-gradient\)"[\s\S]*?:\s*consumed > goal && goal > 0[\s\S]*?\?\s*overBudgetStroke[\s\S]*?:\s*underBudgetStroke[\s\S]*?\}/,
    );
  });

  it("overBudgetStroke falls back to Accent.destructive (red when Tare off)", () => {
    expect(MOBILE_SRC).toMatch(
      /const overBudgetStroke\s*=\s*tare\?\.destructive\s*\?\?\s*Accent\.destructive\s*;/,
    );
  });

  it("underBudgetStroke falls back to Accent.success (green when Tare off)", () => {
    expect(MOBILE_SRC).toMatch(
      /const underBudgetStroke\s*=\s*tare\?\.\w+\s*\?\?\s*Accent\.success\s*;/,
    );
  });

  it("does NOT use the old Build 41 two-state mapping (success-when-at-or-above-goal)", () => {
    expect(MOBILE_SRC).not.toMatch(
      /stroke=\{consumed >= goal && goal > 0\s*\?\s*Accent\.success\s*:\s*"url\(#calorie-ring-gradient\)"\}/,
    );
  });

  it("retains the brand gradient definition so the empty-state stroke still uses it", () => {
    expect(MOBILE_SRC).toMatch(/id="calorie-ring-gradient"/);
    expect(MOBILE_SRC).toMatch(/Accent\.primaryLight/);
    expect(MOBILE_SRC).toMatch(/MacroColors\.fat/);
  });
});

describe("Three-state ring — web DailyRing", () => {
  it("empty → gradient, over → destructive, under → success", () => {
    expect(WEB_SRC).toMatch(
      /stroke=\{[\s\S]*?isEmpty[\s\S]*?\?\s*"url\(#daily-ring-gradient\)"[\s\S]*?:\s*isOverBudget[\s\S]*?\?\s*"var\(--destructive\)"[\s\S]*?:\s*"var\(--success\)"[\s\S]*?\}/,
    );
  });

  it("does NOT use the old Build 41 two-state mapping (success-when-at-or-above-target)", () => {
    expect(WEB_SRC).not.toMatch(
      /stroke=\{consumed >= target && target > 0\s*\?\s*"var\(--success\)"\s*:\s*"url\(#daily-ring-gradient\)"\}/,
    );
  });

  it("retains the brand gradient definition so the empty-state stroke still uses it", () => {
    expect(WEB_SRC).toMatch(/id="daily-ring-gradient"/);
    // Stops use the literal hex from `Accent.primaryLight` →
    // `MacroColors.fat`. Preserve so a colour migration fails this
    // pin instead of silently shipping a different gradient.
    expect(WEB_SRC).toMatch(/stopColor="#6c8cff"/);
    expect(WEB_SRC).toMatch(/stopColor="#e04888"/);
  });
});
