"use client";

/**
 * ProgressHierarchyV1 — ENG-1525 composer (web).
 *
 * The `progress_hierarchy_v1` NEW-branch render for the Progress tab: five
 * sections in fixed order — Trajectory → This Week → Energy → Body
 * composition → Your Week. The host (`ProgressDashboard.tsx`) keeps ALL data
 * fetching/derivation and passes plain props; the legacy 13-card stack stays
 * byte-intact in the host's `else` branch (kill switch).
 *
 * Weight-surface lattice (delta 1):
 *   - "show"        → tinted §1 hero (the ONLY tinted card on the page).
 *   - "trends_only" → §1 renders the plain trend-direction card (no kg).
 *   - "hide"        → NO Trajectory section; §2 This Week promotes to the
 *                     top slot by position (plain card — the tint belongs to
 *                     the weight hero only).
 *
 * Out of scope here (host keeps rendering them around this composer,
 * unchanged): period control, story gate/headline, StreakFreezeCard,
 * Activity section, milestone dialog, LogWeightSheet wiring, footer.
 *
 * Mirror: `apps/mobile/components/progress/hierarchy/ProgressHierarchyV1`.
 */

import * as React from "react";

import type { WeightSurfaceMode } from "../../../../lib/nutrition/weightSurfaceMode";
import {
  ProgressTrajectoryHero,
  type ProgressTrajectoryHeroProps,
} from "./progress-trajectory-hero";
import {
  ProgressWeekSection,
  type ProgressWeekSectionProps,
} from "./progress-week-section";
import {
  ProgressEnergySection,
  type ProgressEnergySectionProps,
} from "./progress-energy-section";
import {
  ProgressBodyCompSection,
  type ProgressBodyCompSectionProps,
} from "./progress-body-comp-section";
import {
  ProgressYourWeekSection,
  type ProgressYourWeekSectionProps,
} from "./progress-your-week-section";

/** Section props minus the layout-owned bits the composer controls. */
export type TrajectoryHeroData = Omit<
  ProgressTrajectoryHeroProps,
  "surfaceMode" | "className"
>;
export type WeekSectionData = Omit<ProgressWeekSectionProps, "className">;
export type EnergySectionData = Omit<ProgressEnergySectionProps, "className">;
export type BodyCompSectionData = Omit<ProgressBodyCompSectionProps, "className">;
export type YourWeekSectionData = Omit<ProgressYourWeekSectionProps, "className">;

export interface ProgressHierarchyV1Props {
  /** Host `effectiveWeightSurfaceMode` (T13 + ENG-713 trend-only pref). */
  weightSurfaceMode: WeightSurfaceMode;
  hero: TrajectoryHeroData;
  week: WeekSectionData;
  energy: EnergySectionData;
  bodyComp: BodyCompSectionData;
  yourWeek: YourWeekSectionData;
  /** `empty_state_grammar_v1`: if weight has fewer than two points but other
   *  progress exists, let that evidence lead and move setup into slot two. */
  promoteAvailableProgress?: boolean;
  className?: string;
}

const SECTION_GAP = "mb-4";

export function ProgressHierarchyV1({
  weightSurfaceMode,
  hero,
  week,
  energy,
  bodyComp,
  yourWeek,
  promoteAvailableProgress = false,
  className,
}: ProgressHierarchyV1Props) {
  const hasAvailableProgress =
    week.days.some((day) => day.calories > 0) ||
    week.streakDays > 0 ||
    energy.hasEnoughData ||
    !yourWeek.shareDisabled;
  const promoteWeek =
    promoteAvailableProgress &&
    weightSurfaceMode === "show" &&
    hero.sparse &&
    hasAvailableProgress;

  return (
    <div className={className} data-testid="progress-hierarchy-v1">
      {promoteWeek ? <ProgressWeekSection {...week} className={SECTION_GAP} /> : null}

      {/* §1 Trajectory — goal-conditional. Full opt-out ("hide") drops the
          section entirely. Under the empty-state grammar a sparse weight
          setup moves below real weekly evidence instead of claiming the hero. */}
      {weightSurfaceMode === "show" || weightSurfaceMode === "trends_only" ? (
        <ProgressTrajectoryHero
          {...hero}
          surfaceMode={weightSurfaceMode}
          className={SECTION_GAP}
        />
      ) : null}

      {/* §2 This Week — always pinned to the current week. */}
      {!promoteWeek ? <ProgressWeekSection {...week} className={SECTION_GAP} /> : null}

      {/* §3 Energy — deficit-led. */}
      <ProgressEnergySection {...energy} className={SECTION_GAP} />

      {/* §4 Body composition — values free, trend Pro-gated (delta 2). */}
      <ProgressBodyCompSection {...bodyComp} className={SECTION_GAP} />

      {/* §5 Your Week — verdict + texture + ghost share. */}
      <ProgressYourWeekSection {...yourWeek} className={SECTION_GAP} />
    </div>
  );
}

export default ProgressHierarchyV1;
