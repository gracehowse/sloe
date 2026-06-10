/**
 * Calorie-ring colour rule — structural pins (mobile + web Sloe 2026-06-04).
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

describe("Sloe calorie ring — mobile CalorieRing", () => {
  it("under-budget arc is PLUM, NOT recoloured destructive when over", () => {
    expect(MOBILE_SRC).toMatch(/const ringStateColor = calorieRingColor/);
    expect(MOBILE_SRC).not.toMatch(
      /ringStateColor = isOver \? Accent\.destructive/,
    );
  });

  it("over-budget draws a lifted-plum overage LAP, NOT red or hash", () => {
    expect(MOBILE_SRC).toMatch(/overageLapColor/);
    expect(MOBILE_SRC).toMatch(/stroke=\{overageLapColor\}/);
    expect(MOBILE_SRC).not.toMatch(/stroke="url\(#overHash\)"/);
    expect(MOBILE_SRC).not.toMatch(/id="overHash"/);
    expect(MOBILE_SRC).not.toMatch(/const overArcColor/);
  });

  it("centre number + label use textColor (ink), not ring stroke hue", () => {
    expect(MOBILE_SRC).toMatch(/color: textColor/);
    expect(MOBILE_SRC).not.toMatch(/color: ringStateColor/);
  });
});

describe("Sloe calorie ring — web DailyRing", () => {
  it("logged arc stays plum; overage uses lifted-plum lap tokens", () => {
    expect(WEB_SRC).toMatch(/var\(--macro-calories\)/);
    expect(WEB_SRC).toMatch(/var\(--ring-overage-lap\)/);
    expect(WEB_SRC).not.toMatch(/url\(#overHash\)/);
    expect(WEB_SRC).not.toMatch(
      /isOverBudget[\s\S]{0,40}\?\s*"var\(--destructive\)"/,
    );
  });

  it("centre number + label use foreground when logged", () => {
    expect(WEB_SRC).toMatch(
      /centerValueColor = isEmpty[\s\S]*\?\s*undefined[\s\S]*?:\s*"var\(--foreground\)"/,
    );
  });
});
