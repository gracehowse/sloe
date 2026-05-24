import { describe, expect, it } from "vitest";
import { Layout } from "../../constants/layout";

describe("Plan layout tokens", () => {
  it("matches Today density (10px scroll, 12px between days)", () => {
    expect(Layout.planScrollGap).toBe(10);
    expect(Layout.planDayGap).toBe(12);
    expect(Layout.planScreenPaddingX).toBe(Layout.todayScreenPaddingX);
  });
});
