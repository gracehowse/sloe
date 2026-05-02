/**
 * Step component registry. The flow shell (Stage C) keys into this
 * map by `currentStepId` rather than importing every step file
 * inline, so adding/removing a step is a one-file change.
 *
 * Customer-lens shrink (2026-04-30): `permissions`, `import`, and
 * `recipes` are no longer part of the linear flow — see comments in
 * `src/lib/onboarding/state.ts` for the rationale and the organic
 * discovery surfaces that absorb their affordances. The component
 * files are kept on disk — re-export them so the post-launch nudge
 * queue (follow-up PR) can mount them out of the linear shell.
 *
 * Build-40 (2026-05-01): the new `data-bridges` step replaces those
 * affordances with a single optional terminal step that bundles the
 * bridges most personas land at the door with (manual targets,
 * notifications, recipe URL — Apple Health on mobile only).
 */
import type { ComponentType } from "react";
import type { StepId } from "@/lib/onboarding/state";
import { WelcomeStep } from "./welcome";
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
import { PermissionsStep } from "./permissions";
import { ImportStep } from "./import";
import { RecipePickerStep } from "./recipes";

/** Step components MAY accept a `compact` prop (used by mobile); the
 *  shell passes it via spread so platform-specific layouts can still
 *  share the same component. */
export interface StepComponentProps {
  compact?: boolean;
}

export const STEP_COMPONENTS: Record<StepId, ComponentType<StepComponentProps>> = {
  welcome: WelcomeStep,
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
};

export {
  WelcomeStep,
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
  // Out-of-flow components — kept for the post-launch nudge queue.
  PermissionsStep,
  ImportStep,
  RecipePickerStep,
};
