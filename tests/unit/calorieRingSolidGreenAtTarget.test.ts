/**
 * Build 41 (TestFlight `AEvjNTAVsipFKDysDkJD2g4`, 2026-05-01) —
 * structural-pin test for the calorie ring stroke logic.
 *
 * User report: "Why is the ring now gradient even when the user has
 * logged instead of green?". The post-59cc821 gradient ran across the
 * whole consumed-vs-target range, so users never saw the "you're done"
 * solid-success signal once they hit their target.
 *
 * Build 41 fix: keep gradient while in progress (`consumed < goal`),
 * switch to solid `Accent.success` (mobile) / `var(--success)` (web)
 * once consumed >= goal. Going over is part of normal calorie
 * tracking, not destructive — green stays through over-budget.
 *
 * This file pins the structural wiring on both platforms so a future
 * refactor that re-introduces the always-gradient stroke fails CI.
 * Source-grep style mirrors `foodSearchFatSecretMerge.test.ts`.
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

describe("Build 41 — mobile CalorieRing solid green at-or-above target", () => {
  it("uses Accent.success when consumed >= goal", () => {
    expect(MOBILE_SRC).toMatch(
      /stroke=\{consumed >= goal && goal > 0\s*\?\s*Accent\.success\s*:\s*"url\(#calorie-ring-gradient\)"\}/,
    );
  });

  it("does NOT branch on isOver for the ring stroke (over keeps green, not destructive)", () => {
    // Build 41 dropped the `isOver ? Accent.destructive : ...` branch
    // on the main calorie ring. The `isOver` ref is still used for
    // the centre TEXT colour, but never to decide the ring stroke.
    expect(MOBILE_SRC).not.toMatch(
      /stroke=\{isOver \? Accent\.destructive : "url\(#calorie-ring-gradient\)"\}/,
    );
  });

  it("retains the brand gradient definition so the in-progress stroke still uses it", () => {
    expect(MOBILE_SRC).toMatch(/id="calorie-ring-gradient"/);
    expect(MOBILE_SRC).toMatch(/Accent\.primaryLight/);
    expect(MOBILE_SRC).toMatch(/MacroColors\.fat/);
  });
});

describe("Build 41 — web DailyRing solid green at-or-above target", () => {
  it("uses var(--success) when consumed >= target", () => {
    expect(WEB_SRC).toMatch(
      /stroke=\{consumed >= target && target > 0\s*\?\s*"var\(--success\)"\s*:\s*"url\(#daily-ring-gradient\)"\}/,
    );
  });

  it("does NOT branch on isOverBudget for the ring stroke (over keeps green, not destructive)", () => {
    expect(WEB_SRC).not.toMatch(
      /stroke=\{isOverBudget \? ringColor : "url\(#daily-ring-gradient\)"\}/,
    );
  });

  it("retains the brand gradient definition so the in-progress stroke still uses it", () => {
    expect(WEB_SRC).toMatch(/id="daily-ring-gradient"/);
    // Stops use the literal hex from `Accent.primaryLight` →
    // `MacroColors.fat`. Preserve so a colour migration fails this
    // pin instead of silently shipping a different gradient.
    expect(WEB_SRC).toMatch(/stopColor="#6c8cff"/);
    expect(WEB_SRC).toMatch(/stopColor="#e04888"/);
  });
});
