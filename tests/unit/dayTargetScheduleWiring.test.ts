/**
 * ENG-960 — pins the day-target schedule WIRING across web + mobile so a
 * refactor can't silently unhook it (the resolver math itself is pinned by
 * dayTargetSchedule.test.ts; the parse by goalEditorPace.test.ts). This guards
 * the integration: the ring applies the schedule for the DISPLAYED weekday, the
 * opt-in picker is present on both editors, and the snapshot records the
 * schedule-adjusted target.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const webRing = read("src/app/components/NutritionTracker.tsx");
const mobileRing = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
const webDialog = read("src/app/components/suppr/goal-pace-editor-dialog.tsx");
const mobileControls = read("apps/mobile/components/recap/GoalPaceControls.tsx");
const appData = read("src/context/AppDataContext.tsx");
const snapshot = read("src/lib/nutrition/dailyTargetSnapshot.ts");
const goalEditor = read("src/lib/nutrition/goalEditorPace.ts");

describe("ENG-960 ring wiring (web + mobile parity)", () => {
  it("both rings resolve the schedule for the DISPLAYED weekday (selectedDate), not new Date()", () => {
    for (const src of [webRing, mobileRing]) {
      expect(src).toMatch(/resolveEffectiveDayTargets\(/);
      // the weekday comes from the displayed day so day-navigation is correct
      expect(src).toMatch(/selectedDate\.getDay\(\)/);
    }
  });

  it("AppDataContext exposes the parsed dayTargetSchedule read from the profile", () => {
    expect(appData).toMatch(/dayTargetSchedule/);
    expect(appData).toMatch(/parseDayTargetSchedule\(/);
    expect(appData).toContain("calorie_schedule, high_days");
  });
});

describe("ENG-960 opt-in picker (both editors)", () => {
  it("the web goal-pace dialog renders the calorie-schedule picker", () => {
    expect(webDialog).toContain('data-testid={`calorie-schedule-option-${opt.value}`}');
  });
  it("the mobile controls expose a CalorieScheduleOptionList", () => {
    expect(mobileControls).toMatch(/export function CalorieScheduleOptionList/);
    expect(mobileControls).toContain("calorie-schedule-option-");
  });
  it("the shared goal editor reads calorie_schedule + high_days into the loaded profile", () => {
    expect(goalEditor).toContain("calorie_schedule, high_days");
    expect(goalEditor).toMatch(/calorieSchedule:/);
  });
});

describe("ENG-960 snapshot records the schedule-adjusted target", () => {
  it("dailyTargetSnapshot resolves the day target through effectiveTargetsForDateKey", () => {
    expect(snapshot).toMatch(/effectiveTargetsForDateKey\(/);
    // both the today snapshot and the backfill loop must be schedule-aware
    expect(snapshot.match(/effectiveTargetsForDateKey\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
