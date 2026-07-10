import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ENG-1448 PR 1 — the browse/library rows were extracted from
// `LogSheet.tsx` into `LogSheetRows.tsx` (400-line discipline).
const LOG_SHEET_ROWS = readFileSync(
  resolve(__dirname, "../../components/today/LogSheetRows.tsx"),
  "utf8",
);
const LOG_SHEET = readFileSync(
  resolve(__dirname, "../../components/today/LogSheet.tsx"),
  "utf8",
);

describe("LogSheet food thumbnail fallback (ENG-1015 / ENG-1448)", () => {
  it("uses FoodFallbackThumb for browse and library rows", () => {
    expect(LOG_SHEET_ROWS).toMatch(/import \{ FoodFallbackThumb \}/);
    expect(LOG_SHEET_ROWS).toMatch(/<FoodFallbackThumb/);
    expect(LOG_SHEET).not.toMatch(/function LogFoodThumbFallback/);
  });

  it("browse/library rows use confirm haptic via PressableScale", () => {
    expect(LOG_SHEET_ROWS).toMatch(/haptic="confirm"/);
    expect(LOG_SHEET_ROWS).toMatch(/import \{ PressableScale \}/);
  });

  it("threads the active slot into the rows so the thumb slot tier works (ENG-1448)", () => {
    // Host → BrowseAndFooter → lists → rows → thumb.
    expect(LOG_SHEET).toMatch(/slotName=\{slot\?\.current \?\? null\}/);
    expect(LOG_SHEET_ROWS).toMatch(/slot=\{slotName\}/);
  });
});
