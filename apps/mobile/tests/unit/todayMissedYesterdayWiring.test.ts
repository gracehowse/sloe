/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep) — Today
 * "missed yesterday" banner wiring.
 *
 * The pure rule + copy live in
 * `src/lib/nutrition/missedYesterday.ts` and are pinned in
 * `tests/unit/missedYesterday.test.ts`. This file pins the host
 * wiring on Today (mobile + web) so a future agent doesn't
 * accidentally delete the render path while the helper survives
 * (or vice versa).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_TODAY = resolve(__dirname, "../../app/(tabs)/index.tsx");
const WEB_TODAY = resolve(
  __dirname,
  "../../../../src/app/components/NutritionTracker.tsx",
);

const MOBILE_SRC = readFileSync(MOBILE_TODAY, "utf8");
const WEB_SRC = readFileSync(WEB_TODAY, "utf8");

describe("Today missed-yesterday banner wiring (DC12)", () => {
  it("mobile Today imports the shared helper + copy", () => {
    expect(MOBILE_SRC).toContain("shouldShowMissedYesterday");
    expect(MOBILE_SRC).toContain("MISSED_YESTERDAY_COPY");
  });

  it("mobile Today renders the banner under a stable testID", () => {
    expect(MOBILE_SRC).toContain('testID="today-missed-yesterday-copy"');
  });

  it("web Today imports the shared helper + copy", () => {
    expect(WEB_SRC).toContain("shouldShowMissedYesterday");
    expect(WEB_SRC).toContain("MISSED_YESTERDAY_COPY");
  });

  it("web Today renders the banner under a stable data-testid", () => {
    expect(WEB_SRC).toContain('data-testid="today-missed-yesterday-copy"');
  });
});
