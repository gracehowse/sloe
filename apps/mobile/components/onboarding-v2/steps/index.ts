/**
 * Mobile step component registry. Mirrors
 * `src/app/components/onboarding-v2/steps/index.ts` (web).
 */
import type { ComponentType } from "react";
import type { StepId } from "@/lib/onboarding-v2";
import { MobileWelcomeStep } from "./welcome";
import { MobileSignupStep } from "./signup";
import { MobileGoalStep } from "./goal";
import { MobileSexStep } from "./sex";
import { MobileAgeStep } from "./age";
import { MobileHeightStep } from "./height";
import { MobileWeightStep } from "./weight";
import { MobileActivityStep } from "./activity";
import { MobilePaceStep } from "./pace";
import { MobileDietStep } from "./diet";
import { MobileStrategyStep } from "./strategy";
import { MobileRevealStep } from "./reveal";
import { MobilePermissionsStep } from "./permissions";
import { MobileImportStep } from "./import";
import { MobileRecipePickerStep } from "./recipes";

export interface MobileStepComponentProps {
  compact?: boolean;
}

export const MOBILE_STEP_COMPONENTS: Record<
  StepId,
  ComponentType<MobileStepComponentProps>
> = {
  welcome: MobileWelcomeStep,
  signup: MobileSignupStep,
  goal: MobileGoalStep,
  sex: MobileSexStep,
  age: MobileAgeStep,
  height: MobileHeightStep,
  weight: MobileWeightStep,
  activity: MobileActivityStep,
  pace: MobilePaceStep,
  diet: MobileDietStep,
  strategy: MobileStrategyStep,
  reveal: MobileRevealStep,
  permissions: MobilePermissionsStep,
  import: MobileImportStep,
  recipes: MobileRecipePickerStep,
};

export {
  MobileWelcomeStep,
  MobileSignupStep,
  MobileGoalStep,
  MobileSexStep,
  MobileAgeStep,
  MobileHeightStep,
  MobileWeightStep,
  MobileActivityStep,
  MobilePaceStep,
  MobileDietStep,
  MobileStrategyStep,
  MobileRevealStep,
  MobilePermissionsStep,
  MobileImportStep,
  MobileRecipePickerStep,
};
