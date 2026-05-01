/**
 * progressStoryGate — empty-state gate for the Progress story headline.
 *
 * Authority: customer-lens audit 2026-04-30 + D-2026-04-27-17.
 *
 * Pins:
 *   - the 3-day floor (`hasEnoughDataForStory`).
 *   - the placeholder copy for 0 / 1 / 2 / 3+ days.
 *   - the ring-fraction math (clamped, ≤ 1, ≥ 0).
 */

import { describe, expect, it } from "vitest";
import {
  STORY_DATA_FLOOR_DAYS,
  buildProgressStoryPlaceholder,
  hasEnoughDataForStory,
} from "../../src/lib/nutrition/progressStoryGate";

describe("hasEnoughDataForStory", () => {
  it("returns false for 0, 1, 2 days", () => {
    expect(hasEnoughDataForStory(0)).toBe(false);
    expect(hasEnoughDataForStory(1)).toBe(false);
    expect(hasEnoughDataForStory(2)).toBe(false);
  });

  it("returns true at the 3-day floor exactly", () => {
    expect(hasEnoughDataForStory(STORY_DATA_FLOOR_DAYS)).toBe(true);
    expect(hasEnoughDataForStory(3)).toBe(true);
  });

  it("returns true above the floor", () => {
    expect(hasEnoughDataForStory(7)).toBe(true);
    expect(hasEnoughDataForStory(28)).toBe(true);
  });

  it("returns false for non-finite / negative input — never crashes a render", () => {
    expect(hasEnoughDataForStory(NaN)).toBe(false);
    expect(hasEnoughDataForStory(-1)).toBe(false);
    // Infinity isn't finite — fall through to false rather than
    // claiming we have enough data for a story.
    expect(hasEnoughDataForStory(Infinity)).toBe(false);
    expect(hasEnoughDataForStory(-Infinity)).toBe(false);
  });
});

describe("buildProgressStoryPlaceholder", () => {
  it("0 days → 'Log a meal to start the count' headline + 0/3 ring", () => {
    const out = buildProgressStoryPlaceholder(0);
    expect(out.eyebrow).toBe("THIS WEEK");
    expect(out.headline).toBe("Your story builds with your data");
    expect(out.body).toBe("Log a meal to start the count. 3 days to your first insight.");
    expect(out.ringFraction).toBe(0);
    expect(out.ringLabel).toBe("0 / 3");
    expect(out.daysToFloor).toBe(3);
  });

  it("1 day → '2 more days' body + 1/3 ring fraction", () => {
    const out = buildProgressStoryPlaceholder(1);
    expect(out.headline).toBe("Your story builds with your data");
    expect(out.body).toBe("2 more days to your first insight.");
    expect(out.ringFraction).toBeCloseTo(1 / 3, 5);
    expect(out.ringLabel).toBe("1 / 3");
    expect(out.daysToFloor).toBe(2);
  });

  it("2 days → 'Almost there' headline + 2/3 ring fraction", () => {
    const out = buildProgressStoryPlaceholder(2);
    expect(out.headline).toBe("Almost there");
    expect(out.body).toBe("One more logged day and your weekly story unlocks.");
    expect(out.ringFraction).toBeCloseTo(2 / 3, 5);
    expect(out.ringLabel).toBe("2 / 3");
    expect(out.daysToFloor).toBe(1);
  });

  it("3 days → ring caps at 1 and label snaps to 3 / 3", () => {
    const out = buildProgressStoryPlaceholder(3);
    expect(out.ringFraction).toBe(1);
    expect(out.ringLabel).toBe("3 / 3");
    expect(out.daysToFloor).toBe(0);
  });

  it("never exceeds 1 fraction even when caller passes more days than the floor", () => {
    const out = buildProgressStoryPlaceholder(99);
    expect(out.ringFraction).toBe(1);
    expect(out.ringLabel).toBe("3 / 3");
  });

  it("treats NaN / negatives as 0 — no broken UI from bad upstream data", () => {
    const a = buildProgressStoryPlaceholder(NaN);
    const b = buildProgressStoryPlaceholder(-2);
    expect(a.ringFraction).toBe(0);
    expect(a.ringLabel).toBe("0 / 3");
    expect(b.ringFraction).toBe(0);
    expect(b.ringLabel).toBe("0 / 3");
  });
});
