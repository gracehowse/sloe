/**
 * MealPlanner — design_system_elevation card ramp + redesign_winmoment
 * rising-edge pulse (P5 parity audit gaps #8 + #33, 2026-05-31).
 *
 * Web↔mobile parity targets:
 *  - Gap #8 (`design_system_elevation`): the three plan cards (summary,
 *    empty-state, per-day) must join the elevation ramp instead of hardcoding
 *    the always-on legacy `card-elevated`. Mirrors `Settings.tsx` (~L652-655)
 *    and the mobile `useCardElevation` hook the planner twin consumes
 *    (`apps/mobile/app/(tabs)/planner.tsx`).
 *  - Gap #33 (`redesign_winmoment`): the headline must scale-pulse on the
 *    rising edge into a 7/7 win — the web analog of the mobile one-shot spring
 *    + success haptic (`summaryPulse` + `prevSummaryToneRef`). The static
 *    colour path stays alive in the flag-off else per the feature-flag rule.
 *
 * Source-text assertions — the established convention for this heavily
 * context-dependent screen (see `mealPlannerLayoutConsolidation.test.ts` and
 * the mobile `planWinMomentParity.test.ts`). They break if either gate is
 * dropped, the flag-off fallback is lost, or the rising-edge guard regresses.
 * The pure tone classifier itself is unit-tested in `planWeekSummary.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/MealPlanner.tsx"),
  "utf8",
);

describe("MealPlanner design_system_elevation card ramp (gap #8)", () => {
  // ENG-822 (Design Direction 2026): the summary, empty-state and per-day
  // cards no longer hand-roll a `cardElevationClass` ternary — they now route
  // through the canonical <SupprCard> primitive, which owns the
  // design_system_elevation flag-gate INTERNALLY (flag ON → soft
  // --elev-card-soft shadow + border dropped; flag OFF → flat border, byte-
  // for-byte). Source-match convention shared with
  // `todayCardElevationSweep.test.ts`; the rendered flag behaviour is covered
  // end-to-end by `progressDashboardElevation.test.tsx`.
  it("routes its resting cards through the canonical SupprCard primitive", () => {
    expect(SRC).toContain("SupprCard");
    expect(SRC).toContain("<SupprCard");
  });

  it("no longer hand-rolls the legacy always-on card-elevated or a manual elevation class", () => {
    expect(SRC).not.toContain("card-elevated");
    expect(SRC).not.toContain("const cardElevationClass = elevation");
  });
});

describe("MealPlanner redesign_winmoment rising-edge pulse (gap #33)", () => {
  it("tracks the previous tone via a ref so the pulse only fires on a tone transition", () => {
    expect(SRC).toContain(
      "const prevSummaryToneRef = useRef<PlanWeekHeadlineTone | null>(null)",
    );
    expect(SRC).toContain("const [winPulse, setWinPulse] = useState(false)");
  });

  it("only celebrates the rising edge INTO win (prev a real non-win tone)", () => {
    // The exact mobile rising-edge guard so an already-7/7 plan never replays.
    expect(SRC).toContain(
      'summaryTone === "win" && prev !== null && prev !== "win"',
    );
    expect(SRC).toContain("setWinPulse(true)");
  });

  it("is gated behind redesign_winmoment with the flag-off path inert", () => {
    expect(SRC).toContain('isFeatureEnabled("redesign_winmoment")');
    // Early-return when the win flag is off — no pulse for the steady state.
    expect(SRC).toContain("if (!winMomentsEnabled) return;");
  });

  it("clears the pulse after the one-shot keyframe duration so a later win can replay", () => {
    expect(SRC).toContain("setTimeout(() => setWinPulse(false), 320)");
    expect(SRC).toContain("clearTimeout(t)");
  });

  it("applies the pulse class to the headline only when the flag is on AND a pulse is live", () => {
    expect(SRC).toContain("winMomentsEnabled && winPulse ? \" planner-win-pulse\" : \"\"");
    expect(SRC).toContain('data-pulse={winMomentsEnabled && winPulse ? "win" : undefined}');
  });

  it("ships the scale keyframe inline with a prefers-reduced-motion guard (no theme.css edit)", () => {
    expect(SRC).toContain("@keyframes planner-win-pulse");
    expect(SRC).toContain("transform: scale(1.06)");
    expect(SRC).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("leaves the steady-state colour shift (transition-colors) intact for the flag-off else", () => {
    // The colour-only payoff must survive — the pulse is additive, not a swap.
    expect(SRC).toContain("text-foreground font-bold -tracking-[0.01em] transition-colors");
  });
});
