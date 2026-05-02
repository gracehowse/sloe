/**
 * Mobile step component registry. Mirrors
 * `src/app/components/onboarding/steps/index.ts` (web).
 *
 * Customer-lens shrink (2026-04-30): `permissions`, `import`, and
 * `recipes` are no longer in the linear flow — components kept and
 * re-exported for the post-launch nudge queue (follow-up). See
 * `src/lib/onboarding/state.ts` for rationale.
 *
 * Build-40 (2026-05-01): the new `data-bridges` step is the linear-flow
 * terminal step. It is the canonical bridge re-introduction (manual
 * targets, Apple Health, notifications, recipe URL); the legacy
 * `permissions.tsx` + `import.tsx` step files remain for back-compat
 * but are no longer the canonical bridge surfaces.
 */
import type { ComponentType } from "react";
import type { StepId } from "@/lib/onboarding";
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
import { MobileDataBridgesStep } from "./data-bridges";
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
  "data-bridges": MobileDataBridgesStep,
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
  MobileDataBridgesStep,
  // Out-of-flow components — kept for the post-launch nudge queue.
  MobilePermissionsStep,
  MobileImportStep,
  MobileRecipePickerStep,
};
