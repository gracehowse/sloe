/**
 * Progress desktop shell + Daily Calories chart scale parity pins.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB = readFileSync(
  resolve(ROOT, "src/app/components/ProgressDashboard.tsx"),
  "utf8",
);
const THEME = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");

describe("Progress desktop layout", () => {
  it("uses the shared product-shell width (not max-w-2xl)", () => {
    expect(THEME).toMatch(/\.product-shell\b/);
    expect(THEME).toMatch(/md:max-w-6xl/);
    expect(WEB).toMatch(/className="product-shell py-pm-6"/);
    expect(WEB).not.toMatch(/max-w-2xl/);
  });

  it("Daily Calories frame chart keeps the 1.15 headroom bar scale (492:2)", () => {
    // The 492:2 frame Daily Calories card keeps the shared 1.15 headroom so
    // over-target bars tower above the goal dots; barMax is 72% of the taller
    // 96px frame chart. The old side-by-side detail grid is removed.
    expect(WEB).toMatch(/const scaleMax = maxCal \* 1\.15/);
    expect(WEB).toMatch(/const barMax = chartHeight \* 0\.72/);
    expect(WEB).toMatch(/data-testid="progress-daily-calories-card"/);
    expect(WEB).not.toMatch(/data-testid="progress-week-charts-grid"/);
  });

  it("weight line chart uses the frame chart height (150)", () => {
    // Relocated frame weight card (492:2) renders the clay line at 150px.
    expect(WEB).toMatch(/ResponsiveContainer width="100%" height=\{150\}/);
  });
});
