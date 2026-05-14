/**
 * digestStory — pure builder for the always-visible "Week digest"
 * narrative card on Progress.
 *
 * Authority: D-2026-04-27-17 + customer-lens audit 2026-04-30.
 *
 * Pins:
 *   - week-range + days-logged sentences are always present.
 *   - calorie sentence flips between under / over / within range.
 *   - protein sentence renders "X of Y" with optional gap-callout.
 *   - closest-to-target line uses the helper-supplied label + numerals.
 *   - sentences are SUPPRESSED (not blank-rendered) when target is 0.
 */

import { describe, expect, it } from "vitest";
import { buildDigestStory } from "../../src/lib/nutrition/digestStory";

const baseInput = {
  weekLabel: "Apr 6 – Apr 12",
  daysLogged: 5,
  avgCalories: 1980,
  targetCalories: 2100,
  avgProtein: 140,
  targetProtein: 150,
  proteinOnTargetDays: 4,
  closestToTarget: { label: "Tuesday", calories: 2105, protein: 152 },
};

describe("buildDigestStory", () => {
  it("emits range + days + calories(under) + protein + closest sentences for a typical week", () => {
    const out = buildDigestStory(baseInput);
    // 2026-05-12 (premium-bar audit DC12): past-tense voice rule —
    // recap eyebrow reframed from "This week" to "Last week" so the
    // surface reads as a closed retrospective, not a present-tense
    // mid-stream nudge.
    expect(out.rangeLine).toBe("Last week (Apr 6 – Apr 12).");
    expect(out.daysLine).toBe("5 of 7 days logged.");
    expect(out.caloriesLine).toBe(
      "You averaged 1,980 kcal vs 2,100 target — 120 under.",
    );
    expect(out.proteinLine).toBe(
      "Hit your protein target on 4 of 5 days logged.",
    );
    expect(out.closestLine).toBe(
      "Tuesday was your closest day (2,105 kcal vs 2,100 target).",
    );
  });

  it("flips to 'over' when avg > target by ≥ 25 kcal", () => {
    const out = buildDigestStory({ ...baseInput, avgCalories: 2300 });
    expect(out.caloriesLine).toBe(
      "You averaged 2,300 kcal vs 2,100 target — 200 over.",
    );
  });

  it("uses 'within range' when delta is < 25 kcal", () => {
    const out = buildDigestStory({ ...baseInput, avgCalories: 2090 });
    expect(out.caloriesLine).toBe(
      "You averaged 2,090 kcal vs 2,100 target — within range.",
    );
  });

  it("appends the protein-gap annotation when avg < 80% of target", () => {
    const out = buildDigestStory({
      ...baseInput,
      avgProtein: 100,
      proteinOnTargetDays: 1,
    });
    // 100g on a 150g target = 66.7% — annotation fires.
    expect(out.proteinLine).toBe(
      "Hit your protein target on 1 of 5 days logged. Average 100g vs 150g target.",
    );
  });

  it("OMITS the protein-gap annotation when avg is comfortably close to target", () => {
    const out = buildDigestStory({
      ...baseInput,
      avgProtein: 130,
      proteinOnTargetDays: 4,
    });
    expect(out.proteinLine).toBe(
      "Hit your protein target on 4 of 5 days logged.",
    );
  });

  it("suppresses calorie sentence when no calorie target is set", () => {
    const out = buildDigestStory({ ...baseInput, targetCalories: 0 });
    expect(out.caloriesLine).toBeNull();
    // Days line still renders — we always tell the user how much they logged.
    expect(out.daysLine).toBe("5 of 7 days logged.");
  });

  it("suppresses protein sentence when no protein target is set", () => {
    const out = buildDigestStory({ ...baseInput, targetProtein: 0 });
    expect(out.proteinLine).toBeNull();
  });

  it("suppresses closest sentence when the helper found no eligible day", () => {
    const out = buildDigestStory({ ...baseInput, closestToTarget: null });
    expect(out.closestLine).toBeNull();
  });

  it("never invents numbers when daysLogged is 0 — calorie + protein sentences are null", () => {
    const out = buildDigestStory({
      ...baseInput,
      daysLogged: 0,
      avgCalories: 0,
      avgProtein: 0,
      proteinOnTargetDays: 0,
      closestToTarget: null,
    });
    expect(out.daysLine).toBe("0 of 7 days logged.");
    expect(out.caloriesLine).toBeNull();
    expect(out.proteinLine).toBeNull();
    expect(out.closestLine).toBeNull();
  });

  it("singular day label when daysLogged === 1", () => {
    const out = buildDigestStory({
      ...baseInput,
      daysLogged: 1,
      proteinOnTargetDays: 1,
    });
    expect(out.daysLine).toBe("1 of 7 days logged.");
    expect(out.proteinLine).toBe(
      "Hit your protein target on 1 of 1 day logged.",
    );
  });

  it("clamps protein-on-target days to daysLogged so we never claim '8 of 5'", () => {
    const out = buildDigestStory({
      ...baseInput,
      daysLogged: 3,
      proteinOnTargetDays: 8, // bad upstream
    });
    expect(out.proteinLine).toBe(
      "Hit your protein target on 3 of 3 days logged.",
    );
  });

  it("paragraph string concatenates the rendered sentences in order", () => {
    const out = buildDigestStory(baseInput);
    expect(out.paragraph).toBe(
      [
        out.rangeLine,
        out.daysLine,
        out.caloriesLine,
        out.proteinLine,
        out.closestLine,
        out.dayOfWeekPatternLine,
      ]
        .filter(Boolean)
        .join(" "),
    );
  });

  it("renders the day-of-week pattern line when the host supplies it", () => {
    const out = buildDigestStory({
      ...baseInput,
      dayOfWeekPattern: { highDay: "Saturday", lowDay: "Tuesday", deltaKcal: 250 },
    });
    expect(out.dayOfWeekPatternLine).toBe(
      "You averaged about 250 more kcal on Saturdays than Tuesdays.",
    );
    // Paragraph picks it up in the documented sentence order.
    expect(out.paragraph.endsWith(out.dayOfWeekPatternLine!)).toBe(true);
  });

  it("suppresses the day-of-week line when no pattern was supplied", () => {
    const out = buildDigestStory({ ...baseInput });
    expect(out.dayOfWeekPatternLine).toBeNull();
  });

  it("suppresses the day-of-week line when the host explicitly passes null", () => {
    const out = buildDigestStory({ ...baseInput, dayOfWeekPattern: null });
    expect(out.dayOfWeekPatternLine).toBeNull();
  });

  it("suppresses the day-of-week line when delta is non-positive (defensive)", () => {
    const out = buildDigestStory({
      ...baseInput,
      dayOfWeekPattern: { highDay: "Saturday", lowDay: "Tuesday", deltaKcal: 0 },
    });
    expect(out.dayOfWeekPatternLine).toBeNull();
  });

  it("formats the kcal delta with thousands separators", () => {
    const out = buildDigestStory({
      ...baseInput,
      dayOfWeekPattern: { highDay: "Friday", lowDay: "Monday", deltaKcal: 1200 },
    });
    expect(out.dayOfWeekPatternLine).toBe(
      "You averaged about 1,200 more kcal on Fridays than Mondays.",
    );
  });
});
