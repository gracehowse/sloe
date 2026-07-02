/**
 * ENG-964 — heuristic goal-date projection for onboarding Reveal.
 *
 * Onboarding does not collect a goal weight. We show a tangible ~12-week
 * milestone at the user's chosen pace so the reveal step feels real
 * without inventing a destination weight. Copy always qualifies with
 * "approximately" / "about" per trust-posture rules.
 */

import { formatGoalDateDayMonthYear } from "../targets/targetsView";
import type { Goal } from "./state";

/** Forward horizon for the first milestone — scope-bounded per onboarding.md. */
export const ONBOARDING_PROJECTION_WEEKS = 12;

export interface OnboardingRevealProjection {
  deltaKg: number;
  dateLabel: string;
  sentence: string;
  /** Current body weight (kg). */
  startKg: number;
  /** Pace-derived milestone weight at ~12 weeks (kg). */
  endKg: number;
  weeks: number;
  /** SVG polyline `points` string (300×86 viewBox, prototype `.ob-proj`). */
  polylinePoints: string;
  startMarker: { x: number; y: number };
  endMarker: { x: number; y: number };
}

const CHART_WIDTH = 300;
const CHART_HEIGHT = 86;
const CHART_PAD_X = 8;
const CHART_PAD_TOP = 18;
const CHART_PAD_BOTTOM = 20;

/** Eased weight→y mapping for the reveal trendline (mirrors Sloe v3 prototype). */
export function computeOnboardingRevealChartGeometry(input: {
  startKg: number;
  endKg: number;
  segments?: number;
}): {
  polylinePoints: string;
  startMarker: { x: number; y: number };
  endMarker: { x: number; y: number };
} {
  const { startKg, endKg, segments = 6 } = input;
  const x0 = CHART_PAD_X;
  const x1 = CHART_WIDTH - CHART_PAD_X;
  const y0 = CHART_PAD_TOP;
  const y1 = CHART_HEIGHT - CHART_PAD_BOTTOM;
  const span = Math.abs(startKg - endKg) || 1;
  const hi = Math.max(startKg, endKg);

  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= segments; i++) {
    const fr = i / segments;
    const x = x0 + (x1 - x0) * fr;
    const ease = 1 - Math.pow(1 - fr, 1.7);
    const weight = startKg + (endKg - startKg) * ease;
    const y = y0 + (y1 - y0) * ((hi - weight) / span);
    pts.push({ x, y });
  }

  return {
    polylinePoints: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    startMarker: pts[0]!,
    endMarker: pts[pts.length - 1]!,
  };
}

export function computeOnboardingRevealProjection(input: {
  goal: Goal | null;
  weightKg: number;
  paceKgPerWeek: number | null;
  weightSkipped: boolean;
}): OnboardingRevealProjection | null {
  const { goal, weightKg, paceKgPerWeek, weightSkipped } = input;
  if (weightSkipped || goal == null || goal === "maintain") return null;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const pace = paceKgPerWeek;
  if (pace == null || !Number.isFinite(pace) || pace <= 0) return null;

  const deltaKg = Math.round(pace * ONBOARDING_PROJECTION_WEEKS * 10) / 10;
  if (deltaKg <= 0) return null;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + ONBOARDING_PROJECTION_WEEKS * 7);
  const dateLabel = formatGoalDateDayMonthYear(targetDate);

  const paceLabel = pace.toFixed(pace < 0.1 ? 2 : 2);

  const startKg = weightKg;
  const endKg =
    goal === "gain"
      ? Math.round((startKg + deltaKg) * 10) / 10
      : Math.round((startKg - deltaKg) * 10) / 10;
  const chart = computeOnboardingRevealChartGeometry({ startKg, endKg });

  if (goal === "lose" || goal === "recomp") {
    return {
      deltaKg,
      dateLabel,
      sentence: `At ~${paceLabel} kg/week, you could lose about ${deltaKg} kg by approximately ${dateLabel}.`,
      startKg,
      endKg,
      weeks: ONBOARDING_PROJECTION_WEEKS,
      ...chart,
    };
  }

  return {
    deltaKg,
    dateLabel,
    sentence: `At ~${paceLabel} kg/week, you could gain about ${deltaKg} kg by approximately ${dateLabel}.`,
    startKg,
    endKg,
    weeks: ONBOARDING_PROJECTION_WEEKS,
    ...chart,
  };
}
