"use client";

/**
 * ProgressEnergySection — ENG-1525 §3 (web).
 *
 * Plain flat card that absorbs the legacy Energy triad + Maintenance card +
 * standalone Expenditure card. ONE number leads: the average daily
 * deficit/surplus (serif 36px step). The equation is the SUPPORT line, in
 * words, with CORRECT arithmetic: maintenance − intake = deficit (surplus
 * when negative) — e.g. "2,073 maintenance − 1,840 intake".
 *
 * Tone comes from the same `trendDirectionTone` family as the §1 hero
 * (delta 3): a deficit implies a losing rate, a surplus a gaining rate —
 * sage when that matches the goal direction, amber when it opposes it,
 * plum when there's no goal. Never red.
 *
 * Confidence is a bare sage overline ("Adaptive · high confidence"), not a
 * pill. Thin data → "building estimate · low confidence" + the existing
 * weigh-ins / logging-days progress bars (host passes the
 * `computeAdaptiveDataProgressFromMeals` result). `MaintenanceExplainer`
 * is reused verbatim (same chain, same collapsed default).
 *
 * The expenditure layer is subordinate: a quiet sparkline (host-supplied
 * points) + the resolved copy's `detail` nuance — the TDEE number itself is
 * NOT repeated (it already leads the equation).
 *
 * Mirror: `apps/mobile/components/progress/hierarchy/ProgressEnergySection`.
 */

import * as React from "react";
import { useState } from "react";

import type {
  MaintenanceConfidence,
  MaintenanceSource,
  ResolvedMaintenance,
} from "../../../../lib/nutrition/resolveMaintenance";
import { maintenanceQualifier } from "../../../../lib/nutrition/energyNumbers";
import type { AdaptiveDataProgress } from "../../../../lib/nutrition/adaptiveDataProgress";
import type { ExpenditureTrendCopy } from "../../../../lib/progress/expenditureTrend";
import type { PlanPace, Sex, ActivityLevel } from "../../../../lib/nutrition/tdee";
import {
  trendDirectionTone,
  type TrendDirectionTone,
} from "../../../../lib/weightProjection";
import { MaintenanceExplainer } from "../../progress/MaintenanceExplainer";
import { SupprCard } from "../../ui/suppr-card";
import { HierarchySectionOverline } from "./hierarchy-section-overline";

export interface ExpenditureSparkPoint {
  key: string;
  kcal: number;
}

export interface ProgressEnergySectionProps {
  /** Range-average intake (`caloriesRange.avgCaloriesPerDay`), null when unlogged. */
  avgIntakeKcal: number | null;
  /** Resolved maintenance (`recapMaintenance`) — the SAME object every sibling reads. */
  resolved: ResolvedMaintenance | null;
  /** Goal context for the deficit/surplus tone (delta 3). */
  latestWeightKg: number | null;
  goalWeightKg: number | null;
  /** Thin-data progress (host `computeAdaptiveDataProgressFromMeals`). */
  adaptiveProgress: AdaptiveDataProgress | null;
  /** Resolved expenditure copy — only its `detail` nuance renders here. */
  expenditureCopy?: ExpenditureTrendCopy | null;
  /** Optional quiet sparkline points (e.g. daily maintenance snapshots). */
  expenditureSparkline?: ExpenditureSparkPoint[] | null;
  /** MaintenanceExplainer pass-through (reused verbatim). */
  sex: Sex;
  weightKg: number | null;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  planPace: PlanPace;
  userGoal: string | null;
  goalCalories: number;
  className?: string;
}

const TONE_CLASS: Record<TrendDirectionTone, string> = {
  toward: "text-success",
  away: "text-warning-solid",
  neutral: "text-foreground-brand",
};

/**
 * Deficit/surplus tone via the shared direction helper: a sustained deficit
 * behaves as a losing rate (negative), a surplus as a gaining one — so §1
 * and §3 can never disagree about whether the user is moving toward goal.
 * The synthetic ±0.1 kg/week sits above the helper's 0.05 epsilon.
 */
function energyTone(
  deficitKcal: number,
  latestKg: number | null,
  goalKg: number | null,
): TrendDirectionTone {
  if (deficitKcal === 0) return "neutral";
  return trendDirectionTone(deficitKcal > 0 ? -0.1 : 0.1, latestKg, goalKg);
}

function confidenceOverline(
  source: MaintenanceSource,
  confidence: MaintenanceConfidence,
): { label: string; thin: boolean } {
  if (source === "formula") {
    return { label: "building estimate · low confidence", thin: true };
  }
  const pill = maintenanceQualifier(source, confidence).pill;
  return { label: `${pill} · ${confidence ?? "medium"} confidence`, thin: false };
}

function ExpenditureSpark({ points }: { points: ExpenditureSparkPoint[] }) {
  if (points.length < 2) return null;
  const w = 100;
  const h = 24;
  const vals = points.map((p) => p.kcal);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(1, max - min);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 3 - ((p.kcal - min) / span) * (h - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      data-testid="hierarchy-energy-spark"
      className="mt-3 opacity-40"
    >
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.25} />
    </svg>
  );
}

export function ProgressEnergySection({
  avgIntakeKcal,
  resolved,
  latestWeightKg,
  goalWeightKg,
  adaptiveProgress,
  expenditureCopy,
  expenditureSparkline,
  sex,
  weightKg,
  heightCm,
  age,
  activityLevel,
  planPace,
  userGoal,
  goalCalories,
  className,
}: ProgressEnergySectionProps) {
  const [explainerOpen, setExplainerOpen] = useState(false);

  const hasEquation =
    resolved != null && avgIntakeKcal != null && avgIntakeKcal > 0;
  const deficitKcal = hasEquation ? Math.round(resolved.kcal - avgIntakeKcal) : null;
  const tone = deficitKcal != null ? energyTone(deficitKcal, latestWeightKg, goalWeightKg) : "neutral";
  const conf = resolved
    ? confidenceOverline(resolved.source, resolved.confidence)
    : { label: "building estimate · low confidence", thin: true };

  return (
    <SupprCard padding="lg" className={className} data-testid="progress-hierarchy-energy">
      <HierarchySectionOverline label="Energy" />

      {/* Bare confidence overline — sage when adaptive/measured, muted while
          the estimate is still building. Deliberately not a pill. */}
      <p
        data-testid="hierarchy-energy-confidence"
        className={`mt-1 text-[11px] font-bold uppercase tracking-[0.1em] ${conf.thin ? "text-muted-foreground" : "text-success"}`}
      >
        {conf.label}
      </p>

      {deficitKcal != null ? (
        <>
          <p className="mt-3" data-testid="hierarchy-energy-lead">
            <span
              className={`font-[family-name:var(--font-headline)] text-[36px] font-medium leading-none tabular-nums ${TONE_CLASS[tone]}`}
            >
              {Math.abs(deficitKcal).toLocaleString()}
            </span>
            <span className="ml-1.5 text-[13px] text-muted-foreground">kcal</span>
          </p>
          <p className="mt-1 text-[13px] font-semibold text-foreground">
            Average daily {deficitKcal === 0 ? "balance" : deficitKcal > 0 ? "deficit" : "surplus"}
          </p>
          {/* The equation in words — maintenance − intake = deficit. */}
          <p
            data-testid="hierarchy-energy-equation"
            className="mt-1 text-[13px] text-muted-foreground tabular-nums"
          >
            {resolved!.kcal.toLocaleString()} maintenance −{" "}
            {Math.round(avgIntakeKcal!).toLocaleString()} intake
          </p>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Log meals and weigh in to see your daily energy balance.
        </p>
      )}

      {/* Subordinate expenditure layer — quiet spark + recency nuance only;
          the kcal figure is NOT repeated (the equation above carries it). */}
      {expenditureSparkline && expenditureSparkline.length >= 2 ? (
        <ExpenditureSpark points={expenditureSparkline} />
      ) : null}
      {expenditureCopy?.detail ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{expenditureCopy.detail}</p>
      ) : null}

      {/* Reused explainer — same chain, same collapsed default (G-4). */}
      {resolved ? (
        <MaintenanceExplainer
          sex={sex}
          weightKg={weightKg}
          heightCm={heightCm}
          age={age}
          activityLevel={activityLevel}
          resolved={resolved}
          planPace={planPace}
          userGoal={userGoal}
          goalCalories={goalCalories}
          open={explainerOpen}
          onToggle={() => setExplainerOpen((v) => !v)}
        />
      ) : null}

      {/* Thin-data progress bars — reuse of the maintenance card's
          `computeAdaptiveDataProgressFromMeals` block, formula-source only. */}
      {resolved?.source === "formula" && adaptiveProgress ? (
        <div
          className="mt-3 pt-3 border-t border-border"
          data-testid="hierarchy-energy-data-progress"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Weigh-ins</span>
                <span className="text-[10px] font-semibold tabular-nums text-foreground">
                  {adaptiveProgress.weighIns}/{adaptiveProgress.weighInsTarget}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (adaptiveProgress.weighIns / adaptiveProgress.weighInsTarget) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">Full logging days</span>
                <span className="text-[10px] font-semibold tabular-nums text-foreground">
                  {adaptiveProgress.loggingDays}/{adaptiveProgress.loggingDaysTarget}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, (adaptiveProgress.loggingDays / adaptiveProgress.loggingDaysTarget) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SupprCard>
  );
}

export default ProgressEnergySection;
