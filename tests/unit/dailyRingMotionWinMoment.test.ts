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
 *  - the goal-hit celebration (formerly gated behind `redesign_winmoment`,
 *    collapsed permanently-on ENG-1651 — the flag was ON in every build since
 *    2026-06-01) lights the ring with the BRAND-SPECTRUM celebration gradient
 *    (`--accent-win-gradient`, ported to the inline `#winSpectrum` SVG
 *    `<linearGradient>`) + a brand-purple glow (`--accent-win`) + the extra
 *    stroke width — the web colour/motion analog of mobile's success haptic.
 *    The steady ring (idle grey track / plum-always arc, capped at full when
 *    over — web ring parity 2026-06-10) is unchanged: the spectrum only paints
 *    while `celebrating`.
 *
 * Source-text assertions — the established convention for this heavily
 * context-dependent component (mirrors `mealPlannerElevationAndWinPulse.test.ts`
 * and `calorieRingSolidGreenAtTarget.test.ts`). They break if the `redesign_motion`
 * gate or its flag-off fallback is lost, or the celebration crosses the
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

  it("renders the centre value at a ring-proportional size in Newsreader (Sloe ring parity)", () => {
    expect(SRC).toContain('motionEnabled');
    // Centre value scales WITH the ring (`size * 0.23`) rather than a fixed 48px,
    // so it keeps mobile's 48/207≈0.23 proportion at every ring size — a fixed
    // 48px overflowed the smaller 160px desktop ring (Grace, 2026-06-07).
    expect(SRC).toMatch(/fontSize:\s*Math\.round\(size \* 0\.23\)/);
    expect(SRC).not.toContain('text-[48px]');
    expect(SRC).toContain('font-[family-name:var(--font-headline)]');
  });
});

describe("DailyRing brand-spectrum goal-hit celebration (redesign_winmoment collapsed permanently-on, ENG-1651)", () => {
  it("only celebrates a green (at/under) goal-hit — unconditional, no flag read", () => {
    // redesign_winmoment collapsed (ENG-1651): the flag was ON in every build
    // since 2026-06-01, so the read is gone and celebration is unconditional
    // on the win-hit itself. The win spectrum still never paints an
    // over-budget or empty ring (three-role law).
    expect(SRC).not.toContain('isFeatureEnabled("redesign_winmoment")');
    expect(SRC).toContain(
      "const celebrating = pulse && !isEmpty && !isOverBudget",
    );
  });

  it("ships the Sloe brand gradient def mirroring --accent-win-gradient (#3B2A4D → #C8794E → #C9892C)", () => {
    // Sloe Phase 0 (dossier D-3): the celebration fill is the warm Sloe brand
    // gradient (plum → clay → amber), replacing the blue→purple→magenta spectrum.
    expect(SRC).toContain('<linearGradient id="winSpectrum"');
    expect(SRC).toContain('stopColor="#3B2A4D"');
    expect(SRC).toContain('stopColor="#C8794E"');
    expect(SRC).toContain('stopColor="#C9892C"');
  });

  it("paints the progress arc with the win-spectrum gradient + glow + thicker stroke ONLY while celebrating", () => {
    expect(SRC).toContain('celebrating\n              ? "url(#winSpectrum)"');
    expect(SRC).toContain("strokeWidth={celebrating ? strokeWidth + 3 : strokeWidth}");
    expect(SRC).toContain('filter: celebrating');
    expect(SRC).toContain('"drop-shadow(0 0 8px var(--accent-win))"');
  });

  it("leaves the steady ring (idle grey / plum-always, capped at full when over) intact below the celebration", () => {
    // web ring parity 2026-06-10 (mobile ring wave): the steady stroke is
    // --macro-calories (plum) in EVERY state — under AND over budget — capped
    // at a full lap when over (the 2026-06-04 --ring-overage-lap second lap was
    // RETIRED in this wave; the over verdict lives in the centre + chip). The
    // empty ring paints the calm idle grey track (--ring-bg). The celebration
    // is additive (a Sloe-gradient OVERRIDE while pulsing), not a swap of the
    // resting hue.
    expect(SRC).toContain('"var(--macro-calories)"');
    expect(SRC).not.toContain('"var(--ring-overage-lap)"');
    expect(SRC).toContain('"var(--ring-bg)"');
  });
});
