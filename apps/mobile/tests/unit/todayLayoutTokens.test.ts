/**
 * Today mobile layout rhythm — pinned to v49 / Claude Design density.
 */
import { describe, expect, it } from "vitest";
import { Layout } from "../../constants/layout";
import { Spacing } from "../../constants/theme";

describe("Today layout tokens", () => {
  it("uses tight hero-cluster gaps (ENG-871)", () => {
    expect(Layout.todayScrollGap).toBe(8);
    expect(Layout.macroTileGridGap).toBe(12);
  });

  it("section break + scroll gap matches Stitch mb-10 (40px)", () => {
    expect(Layout.todayScrollGap + Layout.todaySectionBreak).toBe(40);
  });

  it("uses 20px horizontal padding (prototype phone gutter)", () => {
    expect(Layout.todayScreenPaddingX).toBe(Spacing.lg);
    expect(Spacing.lg).toBe(20);
  });
});
