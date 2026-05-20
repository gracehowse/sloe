/**
 * Three-state ring colour mapping — structural pins for calorie rings.
 *
 *   1. Empty (consumed === 0) → neutral track (no blue→pink gradient).
 *   2. Logged-and-under → solid green (`Accent.success` / `--success`).
 *   3. Logged-and-over → destructive red (`Accent.destructive` / `--destructive`).
 *
 * Centre net number + label mirror the ring stroke when logged.
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
  it("logged → over red, under success (no gradient stroke)", () => {
    expect(MOBILE_SRC).toMatch(/ringStateColor = isOver \? Accent\.destructive : Accent\.success/);
    expect(MOBILE_SRC).toMatch(
      /stroke=\{[\s\S]*?isEmpty[\s\S]*?\? trackColor[\s\S]*?: ringStateColor/,
    );
  });

  it("centre number uses ringStateColor when logged", () => {
    expect(MOBILE_SRC).toMatch(/color: ringStateColor/);
  });

  it("does NOT use the blue→pink brand gradient on the Today ring", () => {
    expect(MOBILE_SRC).not.toMatch(/calorie-ring-gradient/);
    expect(MOBILE_SRC).not.toMatch(/SvgLinearGradient/);
  });
});

describe("Three-state ring — web DailyRing", () => {
  it("logged → over red, under success (no gradient stroke)", () => {
    expect(WEB_SRC).toMatch(
      /stroke=\{[\s\S]*?isEmpty[\s\S]*?"var\(--ring-bg\)"[\s\S]*?: isOverBudget[\s\S]*?\?\s*"var\(--destructive\)"[\s\S]*?:\s*"var\(--success\)"/,
    );
  });

  it("centre number is red or green when logged", () => {
    expect(WEB_SRC).toMatch(
      /centerValueColor = isEmpty[\s\S]*\?\s*undefined[\s\S]*?: isOverBudget[\s\S]*\?\s*"var\(--destructive\)"[\s\S]*?:\s*"var\(--success\)"/,
    );
  });

  it("does NOT use the blue→pink brand gradient on the Today ring", () => {
    expect(WEB_SRC).not.toMatch(/daily-ring-gradient/);
    expect(WEB_SRC).not.toMatch(/#e04888/);
  });
});
