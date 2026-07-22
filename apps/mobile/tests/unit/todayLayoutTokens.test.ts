/**
 * Today mobile layout rhythm — ENG-1655 two-tier grammar.
 */
import { describe, expect, it } from "vitest";
import { Layout } from "../../constants/layout";
import { Spacing } from "../../constants/theme";

describe("Today layout tokens", () => {
  it("uses tight hero-cluster gaps (ENG-871)", () => {
    expect(Layout.todayScrollGap).toBe(8);
    expect(Layout.macroTileGridGap).toBe(12);
  });

  it("section break is 24 (ENG-1655 between-section tier)", () => {
    expect(Layout.todaySectionBreak).toBe(Spacing.xl);
    expect(Layout.todaySectionBreak).toBe(24);
    expect(Layout.todayScrollGap + Layout.todaySectionBreak).toBe(32);
  });

  it("section header/card gaps snap to within-group tier (8 / 12)", () => {
    expect(Layout.todaySectionHeaderGap).toBe(Spacing.sm);
    expect(Layout.todaySectionCardGap).toBe(Spacing.dense);
  });

  it("uses 20px horizontal padding (prototype phone gutter)", () => {
    expect(Layout.todayScreenPaddingX).toBe(Spacing.lg);
    expect(Spacing.lg).toBe(20);
  });
});
