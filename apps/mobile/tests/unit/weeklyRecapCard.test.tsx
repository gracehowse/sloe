// @vitest-environment jsdom
/**
 * WeeklyRecapCard (mobile, ENG-1225 #4) — the react-native-svg mirror of the web
 * shareable recap card. react-native-svg renders its `Text`/`Rect` as Views in
 * the test renderer (no queryable text node), so we assert via the
 * accessibility label + element-type structure. The share path's GUARD branches
 * (off-iOS / rasterise-failed) are covered by `recapShare.test.ts`; the native
 * file-write + Share glue is exercised on-device, not in node (see that file).
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";
import { Text as SvgText, Rect } from "react-native-svg";
import { WeeklyRecapCard } from "../../components/recap/WeeklyRecapCard";

void React;

describe("WeeklyRecapCard (mobile)", () => {
  it("summarises the week in the a11y label + renders the full sparkline", () => {
    const { getByLabelText, UNSAFE_getAllByType } = render(
      <WeeklyRecapCard
        weekLabel="16–22 Jun"
        onTargetDays={5}
        dailyCalories={[1800, 1900, null, 2000, 1700, null, 1850]}
        targetCalories={2000}
        narrative="A steady, consistent week."
      />,
    );
    expect(
      getByLabelText(/16–22 Jun: 5 of 7 days on target\. A steady, consistent week\./),
    ).toBeTruthy();
    // 2 ground rects (lacquer + bloom) + 7 sparkline bars.
    expect(UNSAFE_getAllByType(Rect).length).toBe(9);
    // eyebrow + hero + "days on target" + narrative + 7 day labels + watermark.
    expect(UNSAFE_getAllByType(SvgText).length).toBe(12);
  });

  it("truncates an over-long narrative in the rendered card", () => {
    const long =
      "This is an extremely long narrative line that should be truncated well before the end here";
    const { UNSAFE_getAllByType } = render(
      <WeeklyRecapCard
        weekLabel="16–22 Jun"
        onTargetDays={2}
        dailyCalories={[1800, null, null, null, null, null, null]}
        targetCalories={2000}
        narrative={long}
      />,
    );
    const texts = UNSAFE_getAllByType(SvgText).map((t) => t.props.children);
    expect(texts).toContain(`${long.slice(0, 51)}…`);
  });
});
