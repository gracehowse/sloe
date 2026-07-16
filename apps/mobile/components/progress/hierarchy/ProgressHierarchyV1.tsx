import { View } from "react-native";

import {
  ProgressTrajectoryHero,
  type ProgressTrajectoryHeroProps,
} from "@/components/progress/hierarchy/ProgressTrajectoryHero";
import {
  ProgressWeekSection,
  type ProgressWeekSectionProps,
} from "@/components/progress/hierarchy/ProgressWeekSection";
import {
  ProgressEnergySection,
  type ProgressEnergySectionProps,
} from "@/components/progress/hierarchy/ProgressEnergySection";
import {
  ProgressBodyCompSection,
  type ProgressBodyCompSectionProps,
} from "@/components/progress/hierarchy/ProgressBodyCompSection";
import {
  ProgressYourWeekSection,
  type ProgressYourWeekSectionProps,
} from "@/components/progress/hierarchy/ProgressYourWeekSection";
import { Spacing } from "@/constants/theme";
import type { WeightSurfaceMode } from "@suppr/nutrition-core/weightSurfaceMode";

/**
 * ENG-1525 — the Progress 5-section hierarchy composer (mobile), rendered
 * by the host behind `progress_hierarchy_v1` (read once on mount; the
 * legacy 13-card stack stays byte-intact in the host's else branch as the
 * kill switch). Web twin: `src/app/components/suppr/progress-hierarchy/`.
 *
 * Section order: Trajectory → This Week → Energy → Body composition →
 * Your Week. The period control stays ABOVE this composer in the host (it
 * drives §1's chart window + §3's averaging window; §2 always pins to the
 * current week).
 *
 * Goal-conditional top slot (delta 1): the Trajectory hero renders for
 * `show` (tinted) and `trends_only` (plain, body-neutral copy only); on
 * full opt-out (`hide`) there is NO Trajectory section and This Week
 * leads by position — as a plain card, never tinted (the tint belongs to
 * the weight hero alone).
 *
 * The composer owns only order + rhythm (`gap: Spacing.lg`, matching the
 * host scroll container's inter-card cadence — children must NOT add their
 * own marginBottom, rhythm sweep 2026-06-10). ALL data arrives host-
 * computed through this one typed props object; no section re-derives a
 * number the host already resolved (ENG-1506 anti-drift).
 */
export interface ProgressHierarchyV1Props {
  /** `effectiveWeightSurfaceMode` (T13 + ENG-713 resolved) — drives both
   *  the §1 variant and the §2 promotion. */
  mode: WeightSurfaceMode;
  /** §1 Trajectory hero data (mode is injected by the composer). Null when
   *  the host has nothing to feed it (e.g. charts not ready) — This Week
   *  then leads exactly as in the opt-out ordering. */
  trajectory: Omit<ProgressTrajectoryHeroProps, "mode"> | null;
  /** §2 This Week — always rendered when present. */
  week: ProgressWeekSectionProps | null;
  /** §3 Energy — null when there is no logged data yet. */
  energy: ProgressEnergySectionProps | null;
  /** §4 Body composition — null hides the section (flag off at host). */
  bodyComp: ProgressBodyCompSectionProps | null;
  /** §5 Your Week — null when the week has no story to tell yet. */
  yourWeek: ProgressYourWeekSectionProps | null;
}

export function ProgressHierarchyV1({
  mode,
  trajectory,
  week,
  energy,
  bodyComp,
  yourWeek,
}: ProgressHierarchyV1Props) {
  const showTrajectory = mode !== "hide" && trajectory != null;

  return (
    <View testID="progress-hierarchy-v1" style={{ gap: Spacing.lg }}>
      {showTrajectory ? <ProgressTrajectoryHero mode={mode} {...trajectory} /> : null}
      {week ? <ProgressWeekSection {...week} /> : null}
      {energy ? <ProgressEnergySection {...energy} /> : null}
      {bodyComp ? <ProgressBodyCompSection {...bodyComp} /> : null}
      {yourWeek ? <ProgressYourWeekSection {...yourWeek} /> : null}
    </View>
  );
}

export default ProgressHierarchyV1;
