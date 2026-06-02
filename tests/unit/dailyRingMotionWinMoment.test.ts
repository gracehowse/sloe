/**
 * DailyRing — counting-hero odometer (`redesign_motion`) + brand-spectrum
 * goal-hit celebration (`redesign_winmoment`) (Design Direction 2026, ENG-798/812).
 *
 * Web↔mobile parity targets for the Today cold-open / first deliverable:
 *
 *  - `redesign_motion`: the calorie total is the "counting hero" — under the
 *    flag the centre value renders at display size and odometers up via the
 *    CANONICAL `useOdometer` (the shared 900ms cubic-out curve mobile reads),
 *    not the bespoke `useAnimatedNumber` RAF loop. The flag-off path keeps the
 *    `useAnimatedNumber` lineage (incl. the premium-motion variant) and the
 *    prior 22px / font-bold treatment byte-for-byte.
 *
 *  - `redesign_winmoment`: a goal-hit lights the ring with the BRAND-SPECTRUM
 *    celebration gradient (`--accent-win-gradient`, ported to the inline
 *    `#winSpectrum` SVG `<linearGradient>`) + a brand-purple glow
 *    (`--accent-win`) + the extra stroke width — the web colour/motion analog
 *    of mobile's success haptic. The steady three-state ring (idle gradient /
 *    under green / over red) is unchanged: the spectrum only paints while
 *    `celebrating`.
 *
 * Source-text assertions — the established convention for this heavily
 * context-dependent component (mirrors `mealPlannerElevationAndWinPulse.test.ts`
 * and `calorieRingSolidGreenAtTarget.test.ts`). They break if either gate is
 * dropped, the flag-off fallback is lost, or the celebration crosses the
 * three-role colour law (the win spectrum only on a goal-hit, never steady).
 * The pure odometer math itself is unit-tested in `motion.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/suppr/daily-ring.tsx"),
  "utf8",
);

describe("DailyRing counting-hero odometer (redesign_motion)", () => {
  it("imports the canonical shared odometer hook (not a fresh bespoke loop)", () => {
    expect(SRC).toContain('import { useOdometer } from "../../../lib/useOdometer.ts"');
  });

  it("reads the redesign_motion flag", () => {
    expect(SRC).toContain('const motionEnabled = isFeatureEnabled("redesign_motion")');
  });

  it("calls BOTH the legacy and the canonical hook (rules-of-hooks safe) and selects on the flag", () => {
    // Both hooks must be called unconditionally; only the flagged one renders.
    expect(SRC).toContain("const animatedLegacy = useAnimatedNumber(centerValue");
    expect(SRC).toContain("const animatedOdometer = useOdometer(centerValue");
    expect(SRC).toContain(
      "const animatedCenterValue = motionEnabled ? animatedOdometer : animatedLegacy",
    );
  });

  it("keeps the bespoke useAnimatedNumber path alive for the flag-off branch", () => {
    // The legacy RAF loop must NOT be deleted — flag-off rides it byte-for-byte.
    expect(SRC).toContain("function useAnimatedNumber(");
  });

  it("flag ON renders the centre value at display size; flag OFF keeps the prior 22px treatment", () => {
    expect(SRC).toContain('motionEnabled');
    // 36px (top of the ENG-119 type scale: 11|13|15|18|22|24|28|36) — the
    // counting-hero display size. Was 34px, which the type-scale lint rejects
    // as off-scale (check-type-scale.mjs); 36 is the nearest on-scale value.
    expect(SRC).toContain('"text-[36px] font-extrabold"');
    expect(SRC).toContain('"text-[22px] font-bold"');
  });
});

describe("DailyRing brand-spectrum goal-hit celebration (redesign_winmoment)", () => {
  it("reads the redesign_winmoment flag and only celebrates a green (at/under) goal-hit", () => {
    expect(SRC).toContain('const winEnabled = isFeatureEnabled("redesign_winmoment")');
    // The win spectrum never paints an over-budget or empty ring (three-role law).
    expect(SRC).toContain(
      "const celebrating = pulse && winEnabled && !isEmpty && !isOverBudget",
    );
  });

  it("ships the brand-spectrum gradient def mirroring --accent-win-gradient (#588CE4 → #9679D9 → #DF5EBC)", () => {
    expect(SRC).toContain('<linearGradient id="winSpectrum"');
    expect(SRC).toContain('stopColor="#588CE4"');
    expect(SRC).toContain('stopColor="#9679D9"');
    expect(SRC).toContain('stopColor="#DF5EBC"');
  });

  it("paints the progress arc with the win-spectrum gradient + glow + thicker stroke ONLY while celebrating", () => {
    expect(SRC).toContain('celebrating\n              ? "url(#winSpectrum)"');
    expect(SRC).toContain("strokeWidth={celebrating ? strokeWidth + 3 : strokeWidth}");
    expect(SRC).toContain('filter: celebrating');
    expect(SRC).toContain('"drop-shadow(0 0 8px var(--accent-win))"');
  });

  it("leaves the steady ring (idle gradient / under-green / over-red) intact below the celebration", () => {
    // The under-budget steady stroke stays --success; the celebration is
    // additive (a spectrum OVERRIDE while pulsing), not a swap of the resting hue.
    // ENG-826: the empty ring now paints the calm idle gradient, not flat grey.
    expect(SRC).toContain('"var(--success)"');
    expect(SRC).toContain('"var(--destructive)"');
    expect(SRC).toContain('"url(#ringIdle)"');
  });
});
