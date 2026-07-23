/**
 * Today premium sprint (2026-05-19) — Settings opens from the header avatar
 * on web (mobile uses `/(tabs)/settings` from TodayDateHeader).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

describe("TodayDateHeader — settings entry (web)", () => {
  const headerSrc = readFileSync(
    resolve(REPO, "src/app/components/suppr/today-date-header.tsx"),
    "utf-8",
  );
  const trackerSrc = readFileSync(
    resolve(REPO, "src/app/components/NutritionTracker.tsx"),
    "utf-8",
  );

  it("exposes onOpenSettings on the header contract", () => {
    expect(headerSrc).toMatch(/onOpenSettings:\s*\(\)\s*=>\s*void/);
  });

  it("avatar is a button that calls onOpenSettings", () => {
    expect(headerSrc).toMatch(/onClick=\{onOpenSettings\}/);
    expect(headerSrc).toMatch(/aria-label="Open settings"/);
    expect(headerSrc).not.toMatch(/aria-hidden/);
  });

  it("NutritionTracker wires onOpenSettings from the host", () => {
    expect(trackerSrc).toMatch(/onOpenSettings\?:\s*\(\)\s*=>\s*void/);
    expect(trackerSrc).toMatch(/onOpenSettings=\{\(\)\s*=>\s*onOpenSettings\?\.\(\)\}/);
  });
});

describe("TodayDateHeader — streak-reset supportive line (web, ENG-1504 mobile parity)", () => {
  const headerSrc = readFileSync(
    resolve(REPO, "src/app/components/suppr/today-date-header.tsx"),
    "utf-8",
  );
  const trackerSrc = readFileSync(
    resolve(REPO, "src/app/components/NutritionTracker.tsx"),
    "utf-8",
  );

  it("renders mobile's exact reset-day copy (fresh-day nudge, DC8)", () => {
    expect(headerSrc).toMatch(
      /Every expert was once a beginner\. Start fresh today\./,
    );
  });

  it("stripOnly (the Sloe Today day view) shows the line under the day strip, today only", () => {
    expect(headerSrc).toMatch(
      /\{isToday && streakResetCopyVisible \? streakResetLine : null\}/,
    );
  });

  it("NutritionTracker wires the sticky useStreakResetCopy flag through", () => {
    // Set on a >=1 → 0 protected-streak transition, cleared when the user
    // next renders a positive streak — mirrors mobile
    // `useTodayStreakAndFreezes`. The state machine lives in the extracted
    // `useStreakResetCopy` hook (screen-budget ratchet).
    const hookSrc = readFileSync(
      resolve(REPO, "src/lib/nutrition/useStreakResetCopy.ts"),
      "utf-8",
    );
    expect(hookSrc).toMatch(/setStreakJustReset\(true\);/);
    expect(hookSrc).toMatch(
      /else if \(protectedStreakLength > 0 && streakJustReset\) \{/,
    );
    expect(trackerSrc).toMatch(
      /const streakJustReset = useStreakResetCopy\(protectedStreakLength\);/,
    );
    expect(trackerSrc).toMatch(/streakResetCopyVisible=\{streakJustReset\}/);
  });
});

describe("TodayDateHeader — streak pip zero-day gate (web, ENG-1657 mobile parity)", () => {
  const headerSrc = readFileSync(
    resolve(REPO, "src/app/components/suppr/today-date-header.tsx"),
    "utf-8",
  );

  it("gates showStreakPip behind streak_pip_zero_day_web_v1 (OFF → ≥2 days)", () => {
    expect(headerSrc).toContain('isFeatureEnabled("streak_pip_zero_day_web_v1")');
    expect(headerSrc).toMatch(
      /streakPipZeroDayWeb \? streakDays >= 0 : streakDays >= 2/,
    );
  });
});
