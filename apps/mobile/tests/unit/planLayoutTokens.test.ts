import { describe, expect, it } from "vitest";
import { Layout } from "../../constants/layout";

describe("Plan layout tokens", () => {
  it("matches Today density (scroll gap tracks Today, 12px between days)", () => {
    // Plan's scroll rhythm is pinned to Today's so the two surfaces stay in
    // lockstep. Today moved to the on-scale Spacing.sm (8) under ENG-871, so
    // assert the EQUALITY rather than a hardcoded literal — this can't drift
    // the next time Today's density is retuned.
    expect(Layout.planScrollGap).toBe(Layout.todayScrollGap);
    expect(Layout.planDayGap).toBe(12);
    expect(Layout.planScreenPaddingX).toBe(Layout.todayScreenPaddingX);
  });
});
