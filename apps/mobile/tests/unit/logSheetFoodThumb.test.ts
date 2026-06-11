import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LOG_SHEET = readFileSync(
  resolve(__dirname, "../../components/today/LogSheet.tsx"),
  "utf8",
);

describe("LogSheet food thumbnail fallback (ENG-1015)", () => {
  it("uses FoodFallbackThumb for browse and library rows", () => {
    expect(LOG_SHEET).toMatch(/import \{ FoodFallbackThumb \}/);
    expect(LOG_SHEET).toMatch(/<FoodFallbackThumb/);
    expect(LOG_SHEET).not.toMatch(/function LogFoodThumbFallback/);
  });

  it("browse/library rows use confirm haptic via PressableScale", () => {
    expect(LOG_SHEET).toMatch(/haptic="confirm"/);
    expect(LOG_SHEET).toMatch(/import \{ PressableScale \}/);
  });
});
