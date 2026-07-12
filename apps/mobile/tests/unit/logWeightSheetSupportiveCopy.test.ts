/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep).
 *
 * Pins the Headspace-style supportive moment-of-truth line on the
 * canonical mobile weigh-in surface (`LogWeightSheet`). The line reframes a high-emotion
 * scale moment as a data-helps-you statement; if a future agent
 * decides to dedupe or "tighten" the sheet copy, this test fails
 * so the call can be made deliberately.
 *
 * Web parity is enforced by source-string check on
 * `src/app/components/suppr/progress-weight-log-row.tsx` (extracted from
 * ProgressDashboard in ENG-1504).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SHEET_PATH = resolve(ROOT, "components/progress/LogWeightSheet.tsx");
const WEB_DASH_PATH = resolve(
  ROOT,
  "../../src/app/components/suppr/progress-weight-log-row.tsx",
);

const SUPPORTIVE_LINE = "Every check-in gives us better data for you.";

describe("Weigh-in supportive moment-of-truth copy (DC12)", () => {
  it("LogWeightSheet (mobile canonical) carries the supportive line", () => {
    const src = readFileSync(SHEET_PATH, "utf8");
    expect(src).toContain(SUPPORTIVE_LINE);
    expect(src).toContain("log-weight-supportive-copy");
  });

  it("Web progress-weight-log-row carries the same supportive line (parity)", () => {
    const src = readFileSync(WEB_DASH_PATH, "utf8");
    expect(src).toContain(SUPPORTIVE_LINE);
    expect(src).toContain("weight-input-supportive-copy");
  });
});
