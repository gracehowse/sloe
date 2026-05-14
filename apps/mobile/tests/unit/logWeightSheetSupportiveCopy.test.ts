/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep).
 *
 * Pins the Headspace-style supportive moment-of-truth line on the
 * canonical mobile weigh-in surface (`LogWeightSheet`) and on the
 * legacy `/weight-tracker` route. The line reframes a high-emotion
 * scale moment as a data-helps-you statement; if a future agent
 * decides to dedupe or "tighten" the sheet copy, this test fails
 * so the call can be made deliberately.
 *
 * Web parity is enforced by source-string check on
 * `src/app/components/ProgressDashboard.tsx`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SHEET_PATH = resolve(ROOT, "components/progress/LogWeightSheet.tsx");
const TRACKER_PATH = resolve(ROOT, "app/weight-tracker.tsx");
const WEB_DASH_PATH = resolve(
  ROOT,
  "../../src/app/components/ProgressDashboard.tsx",
);

const SUPPORTIVE_LINE = "Every check-in gives us better data for you.";

describe("Weigh-in supportive moment-of-truth copy (DC12)", () => {
  it("LogWeightSheet (mobile canonical) carries the supportive line", () => {
    const src = readFileSync(SHEET_PATH, "utf8");
    expect(src).toContain(SUPPORTIVE_LINE);
    expect(src).toContain("log-weight-supportive-copy");
  });

  it("/weight-tracker legacy route carries the supportive line", () => {
    const src = readFileSync(TRACKER_PATH, "utf8");
    expect(src).toContain(SUPPORTIVE_LINE);
    expect(src).toContain("weight-tracker-supportive-copy");
  });

  it("Web ProgressDashboard carries the same supportive line (parity)", () => {
    const src = readFileSync(WEB_DASH_PATH, "utf8");
    expect(src).toContain(SUPPORTIVE_LINE);
    expect(src).toContain("weight-input-supportive-copy");
  });
});
