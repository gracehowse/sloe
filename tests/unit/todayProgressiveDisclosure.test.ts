import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_TDEE_HINT_MIN_LOGGED_DAYS,
  QUICK_ADD_COLLAPSED_STORAGE_KEY,
  isAdaptiveTdeeHintVisible,
  isHydrationCardVisible,
  isStepsCardVisible,
  parseQuickAddCollapsed,
  serializeQuickAddCollapsed,
} from "@/lib/nutrition/todayProgressiveDisclosure";

describe("Today progressive disclosure — Hydration gate", () => {
  const empty = {
    waterTargetMl: 0,
    extraWaterByDay: {},
    waterFromMealsMl: 0,
    extraCaffeineByDay: {},
    extraAlcoholGByDay: {},
  };

  it("hides on first run when the user has no target and has logged nothing", () => {
    expect(isHydrationCardVisible(empty)).toBe(false);
  });

  it("reveals once a non-zero water target is set", () => {
    expect(isHydrationCardVisible({ ...empty, waterTargetMl: 2000 })).toBe(true);
  });

  it("ignores zero or negative water targets", () => {
    expect(isHydrationCardVisible({ ...empty, waterTargetMl: 0 })).toBe(false);
    expect(isHydrationCardVisible({ ...empty, waterTargetMl: -500 })).toBe(false);
  });

  it("reveals once the user has logged water via quick-add", () => {
    expect(
      isHydrationCardVisible({ ...empty, extraWaterByDay: { "2026-04-17": 250 } }),
    ).toBe(true);
  });

  it("reveals once a logged meal contributes waterMl", () => {
    expect(isHydrationCardVisible({ ...empty, waterFromMealsMl: 150 })).toBe(true);
  });

  it("reveals once the user has logged caffeine", () => {
    expect(
      isHydrationCardVisible({ ...empty, extraCaffeineByDay: { "2026-04-17": 80 } }),
    ).toBe(true);
  });

  it("reveals once the user has logged alcohol", () => {
    expect(
      isHydrationCardVisible({ ...empty, extraAlcoholGByDay: { "2026-04-17": 14 } }),
    ).toBe(true);
  });

  it("does not reveal when maps contain only zeros", () => {
    expect(
      isHydrationCardVisible({ ...empty, extraWaterByDay: { "2026-04-17": 0 } }),
    ).toBe(false);
  });
});

describe("Today progressive disclosure — Steps gate", () => {
  it("hides when neither steps nor activity burn has any data", () => {
    expect(isStepsCardVisible({ stepsByDay: {}, activityBurnByDay: {} })).toBe(false);
  });

  it("reveals when steps have been recorded for any day", () => {
    expect(
      isStepsCardVisible({ stepsByDay: { "2026-04-17": 5000 }, activityBurnByDay: {} }),
    ).toBe(true);
  });

  it("reveals when activity burn is recorded for any day", () => {
    expect(
      isStepsCardVisible({ stepsByDay: {}, activityBurnByDay: { "2026-04-17": 250 } }),
    ).toBe(true);
  });

  it("reveals when a zero-step sync has happened (evidence of Health connection)", () => {
    expect(
      isStepsCardVisible({ stepsByDay: { "2026-04-17": 0 }, activityBurnByDay: {} }),
    ).toBe(true);
  });

  it("reveals when a zero-burn sync has happened", () => {
    expect(
      isStepsCardVisible({ stepsByDay: {}, activityBurnByDay: { "2026-04-17": 0 } }),
    ).toBe(true);
  });
});

describe("Today progressive disclosure — Adaptive TDEE hint gate", () => {
  it("hides for a fresh user with no adaptive data", () => {
    expect(
      isAdaptiveTdeeHintVisible({ adaptiveTdee: null, adaptiveTdeeConfidence: null, loggedDayCount: 0 }),
    ).toBe(false);
  });

  it("hides when confidence is 'low' even if adaptive TDEE has a number", () => {
    expect(
      isAdaptiveTdeeHintVisible({
        adaptiveTdee: 2200,
        adaptiveTdeeConfidence: "low",
        loggedDayCount: 3,
      }),
    ).toBe(false);
  });

  it("reveals at medium confidence — matches getEffectiveTDEE threshold", () => {
    expect(
      isAdaptiveTdeeHintVisible({
        adaptiveTdee: 2200,
        adaptiveTdeeConfidence: "medium",
        loggedDayCount: 7,
      }),
    ).toBe(true);
  });

  it("reveals at high confidence", () => {
    expect(
      isAdaptiveTdeeHintVisible({
        adaptiveTdee: 2200,
        adaptiveTdeeConfidence: "high",
        loggedDayCount: 30,
      }),
    ).toBe(true);
  });

  it("reveals once the user has ≥ 14 logged days even without confident adaptive TDEE", () => {
    expect(
      isAdaptiveTdeeHintVisible({
        adaptiveTdee: null,
        adaptiveTdeeConfidence: null,
        loggedDayCount: ADAPTIVE_TDEE_HINT_MIN_LOGGED_DAYS,
      }),
    ).toBe(true);
  });

  it("is still hidden at 13 logged days with no confidence", () => {
    expect(
      isAdaptiveTdeeHintVisible({
        adaptiveTdee: null,
        adaptiveTdeeConfidence: null,
        loggedDayCount: 13,
      }),
    ).toBe(false);
  });
});

describe("Quick Add collapsed persistence", () => {
  it("exposes a stable storage key shared by web and mobile", () => {
    expect(QUICK_ADD_COLLAPSED_STORAGE_KEY).toBe("suppr-quick-add-collapsed-v1");
  });

  it("defaults to collapsed when no preference is stored (first run)", () => {
    expect(parseQuickAddCollapsed(null)).toBe(true);
    expect(parseQuickAddCollapsed(undefined)).toBe(true);
  });

  it("round-trips through serialise + parse", () => {
    expect(parseQuickAddCollapsed(serializeQuickAddCollapsed(true))).toBe(true);
    expect(parseQuickAddCollapsed(serializeQuickAddCollapsed(false))).toBe(false);
  });

  it("treats unknown raw values as the first-run default (collapsed)", () => {
    expect(parseQuickAddCollapsed("garbage")).toBe(true);
    expect(parseQuickAddCollapsed("")).toBe(true);
  });
});
