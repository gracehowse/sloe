// @vitest-environment jsdom
/**
 * Plan v3 header week-anchor contract (ENG-1480).
 *
 * The header overline + week strip derive from ONE shared anchor
 * (`usePlanV3WeekAnchor`):
 *   - plan HAS real meals + persisted start_date → the anchor's week
 *     (parsed at local midnight, never a bare UTC `new Date("YYYY-MM-DD")`);
 *   - plan is EMPTY → prospective week (today + start-offset chip), even
 *     when a stale start_date survives from a since-cleared plan.
 *
 * Kills the captured flicker (ENG-1317 review: "9–15 July" → "5–11 July"
 * 500ms apart): pre-hydration and settled frames agree for empty plans,
 * and a dead anchor can no longer label an empty week.
 */
import * as React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react-native";

import { usePlanV3WeekAnchor } from "../../hooks/usePlanV3WeekAnchor";
import { formatPlanDateKey } from "@suppr/shared/mealPlan/planCalendarAnchor";

void React;

describe("usePlanV3WeekAnchor (ENG-1480)", () => {
  it("empty plan ignores a stale persisted anchor — prospective week from today", () => {
    const { result } = renderHook(() =>
      usePlanV3WeekAnchor({
        planHasRealMeals: false,
        planStartDate: "2026-07-05", // dead anchor from a cleared plan
        startOffset: 0,
      }),
    );
    expect(formatPlanDateKey(result.current.weekDates[0])).toBe(
      formatPlanDateKey(new Date()),
    );
  });

  it("real plan uses the persisted anchor at local midnight", () => {
    const { result } = renderHook(() =>
      usePlanV3WeekAnchor({
        planHasRealMeals: true,
        planStartDate: "2026-07-05",
        startOffset: 0,
      }),
    );
    expect(formatPlanDateKey(result.current.weekDates[0])).toBe("2026-07-05");
    expect(result.current.weekLabel).toBe("5–11 July");
    expect(result.current.weekDates).toHaveLength(7);
    expect(formatPlanDateKey(result.current.weekDates[6])).toBe("2026-07-11");
  });

  it("cross-month label renders both month names", () => {
    const { result } = renderHook(() =>
      usePlanV3WeekAnchor({
        planHasRealMeals: true,
        planStartDate: "2026-07-29",
        startOffset: 0,
      }),
    );
    expect(result.current.weekLabel).toBe("29 July – 4 August");
  });

  it("planner.tsx consumes the hook for both overline and strip", () => {
    const src = readFileSync(
      resolve(__dirname, "../../app/(tabs)/planner.tsx"),
      "utf8",
    );
    expect(src).toMatch(
      /\{ weekLabel: planV3WeekLabel, weekDates: planV3WeekDates \}\s*=\s*usePlanV3WeekAnchor\(\{ planHasRealMeals, planStartDate, startOffset \}\)/,
    );
    expect(src).not.toMatch(/new Date\(planStartDate\)/);
  });
});
