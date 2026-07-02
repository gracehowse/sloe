/**
 * Mobile step component registry. Mirrors
 * `src/app/components/onboarding/steps/index.ts` (web).
 *
 * Customer-lens shrink (2026-04-30): `permissions`, `import`, and
 * `recipes` are no longer in the linear flow. `permissions` + `import`
 * are kept and re-exported for a post-launch nudge surface. See
 * `src/lib/onboarding/state.ts` for rationale.
 *
 * Picker cut (2026-05-30): the `recipes` picker step + its
 * `RecipePickerGrid` were deleted for parity with web. The library is
 * seeded with curated defaults at onboarding completion (see
 * `mobile-flow.tsx`), and the Today nudge queue's `recipes` nudge
 * deep-links to the Library tab rather than mounting this picker — so
 * it had no live call site and was removed rather than left dormant.
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
import { MobileAppChoiceStep } from "./app-choice";
import { MobileWhyNowStep } from "./why-now";
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
import { UpgradeStep } from "./upgrade";
import { FirstLogStep } from "./first-log";
import { MobilePermissionsStep } from "./permissions";
import { MobileImportStep } from "./import";

export interface MobileStepComponentProps {
  compact?: boolean;
}

export const MOBILE_STEP_COMPONENTS: Record<
  StepId,
  ComponentType<MobileStepComponentProps>
> = {
  welcome: MobileWelcomeStep,
  "app-choice": MobileAppChoiceStep,
  "why-now": MobileWhyNowStep,
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
  upgrade: UpgradeStep,
  "first-log": FirstLogStep,
};

export {
  MobileWelcomeStep,
  MobileAppChoiceStep,
  MobileWhyNowStep,
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
  // Out-of-flow components — kept for a post-launch nudge surface.
  MobilePermissionsStep,
  MobileImportStep,
};
