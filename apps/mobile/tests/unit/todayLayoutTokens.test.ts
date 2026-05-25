/**
 * Today mobile layout rhythm — pinned to v49 / Claude Design density.
 */
import { describe, expect, it } from "vitest";
import { Layout } from "../../constants/layout";
import { Spacing } from "../../constants/theme";

describe("Today layout tokens", () => {
  it("uses 10px block gaps (not the global 16px md bump)", () => {
    expect(Layout.todayScrollGap).toBe(10);
    expect(Layout.macroTileGridGap).toBe(10);
  });

  it("uses 20px horizontal padding (prototype phone gutter)", () => {
    expect(Layout.todayScreenPaddingX).toBe(Spacing.lg);
    expect(Spacing.lg).toBe(20);
  });
});
