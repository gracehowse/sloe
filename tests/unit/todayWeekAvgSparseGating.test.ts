/**
 * ENG-1372 slice 2 — "This week" avg-stat sparse gating, HOST wiring
 * (source pins). Both hosts (`NutritionTracker.tsx` web,
 * `TodayScreen.tsx` mobile) must pass `null` for the week-average prop
 * whenever fewer than 3 days are logged AND `empty_state_grammar_v1` is
 * on — closing the gap where a single logged day's total rendered as a
 * "929 avg"-style stat that reads as a stable weekly average.
 *
 * Render-level behaviour is covered by
 * `todayDesktopRightRailSparseAvg.test.tsx` (web) and the existing
 * `weeklyInsightCardMobile.test.tsx` (mobile) — this file pins the HOST
 * gating expression since both host files are too large for a full
 * render harness (pinned in `scripts/screen-line-budget.json`).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB = readFileSync(resolve(ROOT, "src/app/components/NutritionTracker.tsx"), "utf8");
const MOBILE = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/_today/TodayScreen.tsx"),
  "utf8",
);

describe("Today week-avg sparse gating — web (NutritionTracker -> TodayDesktopRightRail)", () => {
  it("gates weekAvgKcal on >=3 logged days when empty_state_grammar_v1 is on", () => {
    expect(WEB).toMatch(
      /isFeatureEnabled\("empty_state_grammar_v1"\) \? weekData\.loggedDaysInWeek >= 3 : weekData\.loggedDaysInWeek > 0/,
    );
  });
});

describe("Today week-avg sparse gating — mobile (TodayScreen -> WeeklyInsightCard)", () => {
  it("gates weekAvgKcal on >=3 logged days when empty_state_grammar_v1 is on", () => {
    expect(MOBILE).toMatch(
      /isFeatureEnabled\("empty_state_grammar_v1"\) \? weekData\.days\.filter\(\(d\) => d\.totals\.calories > 0\)\.length >= 3 : weekData\.days\.some\(\(d\) => d\.totals\.calories > 0\)/,
    );
  });
});
