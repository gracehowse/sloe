import { describe, expect, it } from "vitest";
import {
  COOK_STEP_SWIPE_THRESHOLD_RATIO,
  COOK_STEP_SWIPE_VELOCITY_THRESHOLD,
  cookStepSwipeRubberBand,
  resolveCookStepSwipe,
} from "../../src/lib/nutrition/cookStepSwipe.ts";

describe("cookStepSwipe helpers", () => {
  const width = 390;

  it("commits next when translation passes the ratio threshold", () => {
    const threshold = width * COOK_STEP_SWIPE_THRESHOLD_RATIO;
    expect(
      resolveCookStepSwipe({
        translationX: -(threshold + 1),
        velocityX: 0,
        viewportWidth: width,
        stepIndex: 1,
        stepCount: 5,
      }),
    ).toBe("next");
  });

  it("commits prev when translation passes the ratio threshold", () => {
    const threshold = width * COOK_STEP_SWIPE_THRESHOLD_RATIO;
    expect(
      resolveCookStepSwipe({
        translationX: threshold + 1,
        velocityX: 0,
        viewportWidth: width,
        stepIndex: 2,
        stepCount: 5,
      }),
    ).toBe("prev");
  });

  it("commits on fast flick even when distance is short", () => {
    expect(
      resolveCookStepSwipe({
        translationX: -20,
        velocityX: -(COOK_STEP_SWIPE_VELOCITY_THRESHOLD + 1),
        viewportWidth: width,
        stepIndex: 0,
        stepCount: 3,
      }),
    ).toBe("next");
  });

  it("does not advance past the last step", () => {
    expect(
      resolveCookStepSwipe({
        translationX: -200,
        velocityX: -800,
        viewportWidth: width,
        stepIndex: 2,
        stepCount: 3,
      }),
    ).toBe("none");
  });

  it("does not retreat before the first step", () => {
    expect(
      resolveCookStepSwipe({
        translationX: 200,
        velocityX: 800,
        viewportWidth: width,
        stepIndex: 0,
        stepCount: 3,
      }),
    ).toBe("none");
  });

  it("rubber-bands at the edges", () => {
    expect(cookStepSwipeRubberBand(100, 0, 4)).toBe(35);
    expect(cookStepSwipeRubberBand(-100, 3, 4)).toBe(-35);
    expect(cookStepSwipeRubberBand(100, 1, 4)).toBe(100);
  });
});
