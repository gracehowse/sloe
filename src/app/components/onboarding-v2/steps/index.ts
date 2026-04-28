/**
 * Step component registry. The flow shell (Stage C) keys into this
 * map by `currentStepId` rather than importing every step file
 * inline, so adding/removing a step is a one-file change.
 */
import type { ComponentType } from "react";
import type { StepId } from "@/lib/onboarding/v2/state";
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
  permissions: PermissionsStep,
  import: ImportStep,
  recipes: RecipePickerStep,
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
  PermissionsStep,
  ImportStep,
  RecipePickerStep,
};
