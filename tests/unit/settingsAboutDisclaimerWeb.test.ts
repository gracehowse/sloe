/**
 * Web Settings — the v3 set-ver footer's nutrition-estimates disclaimer
 * (ENG-1247 A18). The "Nutrition values are estimates" compliance line lives
 * in the About card so it renders in BOTH the two-pane and legacy Settings
 * paths. Mobile parity is pinned in
 * `apps/mobile/tests/unit/settingsBundleParity.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS = readFileSync(
  resolve(__dirname, "../../src/app/components/Settings.tsx"),
  "utf8",
);

describe("web Settings — nutrition-estimates disclaimer", () => {
  it("renders the compliance disclaimer line", () => {
    expect(SETTINGS).toContain("Nutrition values are estimates");
  });

  it("places it inside the About card (renders in both render paths)", () => {
    const aboutIdx = SETTINGS.indexOf("const aboutCard");
    const disclaimerIdx = SETTINGS.indexOf("Nutrition values are estimates");
    expect(aboutIdx).toBeGreaterThan(-1);
    expect(disclaimerIdx).toBeGreaterThan(aboutIdx);
    // Within the aboutCard block (before the next card const).
    const promoIdx = SETTINGS.indexOf("const promoCard");
    expect(disclaimerIdx).toBeLessThan(promoIdx);
  });
});
