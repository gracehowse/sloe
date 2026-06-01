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
  it("reads the elevation flag and derives a flag-gated card class", () => {
    expect(SRC).toContain('isFeatureEnabled("design_system_elevation")');
    expect(SRC).toContain("const cardElevationClass = elevation");
  });

  it("flag ON drops the hairline border and rides the soft --elev-card-soft shadow", () => {
    expect(SRC).toContain("border-0 shadow-[var(--elev-card-soft)]");
  });

  it("flag OFF keeps the legacy `border border-border card-elevated` fallback alive", () => {
    expect(SRC).toContain("border border-border card-elevated");
  });

  it("the summary card consumes the elevation class (no hardcoded card-elevated)", () => {
    expect(SRC).toContain(
      "className={`rounded-2xl bg-card mb-4 ${cardElevationClass}`}",
    );
    // The old always-on summary-card class must be gone.
    expect(SRC).not.toContain(
      'className="rounded-2xl border border-border bg-card mb-4 card-elevated"',
    );
  });

  it("the empty-state card consumes the elevation class (no hardcoded card-elevated)", () => {
    expect(SRC).toContain(
      "className={`flex flex-col items-center justify-center rounded-2xl bg-card ${cardElevationClass}`}",
    );
    expect(SRC).not.toContain(
      'className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card card-elevated"',
    );
  });

  it("the per-day card branches on the elevation flag and keeps the today-column tint in both states", () => {
    // Flag ON: border-0 + soft shadow, today distinction rests on bg tint.
    expect(SRC).toContain("border-0 shadow-[var(--elev-card-soft)] bg-primary/10");
    expect(SRC).toContain("border-0 shadow-[var(--elev-card-soft)] bg-card");
    // Flag OFF: the prior per-state border colour + card-elevated, byte-for-byte.
    expect(SRC).toContain("border border-primary/30 card-elevated bg-primary/10");
    expect(SRC).toContain("border border-border card-elevated bg-card");
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
