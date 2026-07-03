/**
 * Step component registry. The flow shell (Stage C) keys into this
 * map by `currentStepId` rather than importing every step file
 * inline, so adding/removing a step is a one-file change.
 *
 * Customer-lens shrink (2026-04-30): `permissions`, `import`, and
 * `recipes` are no longer part of the linear flow — see comments in
 * `src/lib/onboarding/state.ts` for the rationale and the organic
 * discovery surfaces that absorb their affordances. `permissions` and
 * `import` are kept on disk and re-exported so a post-launch nudge
 * surface can mount them out of the linear shell.
 *
 * Picker cut (2026-05-30): the `recipes` picker step was deleted. The
 * library is seeded with curated defaults at onboarding completion
 * (see `web-flow.tsx`), and the only post-onboarding "add recipes"
 * prompt — the mobile nudge queue's `recipes` nudge — deep-links to
 * the Library tab, not this component. The picker had no live mount
 * point on either platform, so it was removed rather than left dormant.
 *
 * Build-40 (2026-05-01): the new `data-bridges` step replaces those
 * affordances with a single optional terminal step that bundles the
 * bridges most personas land at the door with (manual targets,
 * notifications, recipe URL — Apple Health on mobile only).
 */
import type { ComponentType } from "react";
import type { StepId } from "@/lib/onboarding/state";
import { WelcomeStep } from "./welcome";
import { AppChoiceStep } from "./app-choice";
import { WhyNowStep } from "./why-now";
import { SignupStep } from "./signup";
import { GoalStep } from "./goal";
import { SexStep } from "./sex";
import { AgeStep } from "./age";
import { HeightStep } from "./height";
import { WeightStep } from "./weight";
import { ActivityStep } from "./activity";
import { PaceStep } from "./pace";
import { DietStep } from "./diet";
import { StrategyStep } from "./strategy";
import { RevealStep } from "./reveal";
import { DataBridgesStep } from "./data-bridges";
import { UpgradeStep } from "./upgrade";
import { FirstLogStep } from "./first-log";
import { PermissionsStep } from "./permissions";

/** Step components MAY accept a `compact` prop (used by mobile); the
 *  shell passes it via spread so platform-specific layouts can still
 *  share the same component. */
export interface StepComponentProps {
  compact?: boolean;
}

export const STEP_COMPONENTS: Record<StepId, ComponentType<StepComponentProps>> = {
  welcome: WelcomeStep,
  "app-choice": AppChoiceStep,
  "why-now": WhyNowStep,
  signup: SignupStep,
  goal: GoalStep,
  sex: SexStep,
  age: AgeStep,
  height: HeightStep,
  weight: WeightStep,
  activity: ActivityStep,
  pace: PaceStep,
  diet: DietStep,
  strategy: StrategyStep,
  reveal: RevealStep,
  "data-bridges": DataBridgesStep,
  upgrade: UpgradeStep,
  "first-log": FirstLogStep,
};

export {
  WelcomeStep,
  AppChoiceStep,
  WhyNowStep,
  SignupStep,
  GoalStep,
  SexStep,
  AgeStep,
  HeightStep,
  WeightStep,
  ActivityStep,
  PaceStep,
  DietStep,
  StrategyStep,
  RevealStep,
  DataBridgesStep,
  // Out-of-flow component — kept for a post-launch nudge surface.
  PermissionsStep,
};
