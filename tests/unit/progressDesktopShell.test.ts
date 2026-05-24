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

  it("Daily Calories chart mirrors mobile bar scale (1.15 headroom, 78% barMax)", () => {
    expect(WEB).toMatch(/const scaleMax = maxCal \* 1\.15/);
    expect(WEB).toMatch(/const barMax = chartHeight \* 0\.78/);
    expect(WEB).toMatch(/data-testid="progress-week-charts-grid"/);
  });

  it("weight line chart uses mobile chart height", () => {
    expect(WEB).toMatch(/ResponsiveContainer width="100%" height=\{170\}/);
  });
});
