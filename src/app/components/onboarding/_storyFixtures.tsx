import type { ReactNode } from "react";
import { OnboardingProvider } from "./context";
import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
  type OnboardingState,
  type StepId,
} from "@/lib/onboarding/state";

export function onboardingStepIndex(stepId: StepId): number {
  return STEP_IDS.indexOf(stepId);
}

/** Body-stat answers filled so reveal / pace / strategy steps render targets. */
export const STORY_ONBOARDING_FILLED: Partial<OnboardingState> = {
  goal: "lose",
  whyNow: "feel-better",
  sex: "female",
  age: 32,
  heightCm: 168,
  weightKg: 68,
  activity: "moderate",
  paceKgPerWeek: 0.5,
  diet: ["vegetarian"],
  nutritionStrategy: "balanced",
  appChoice: "mfp",
};

export function onboardingStoryInitial(
  stepId: StepId,
  overrides: Partial<OnboardingState> = {},
): Partial<OnboardingState> {
  return {
    ...DEFAULT_ONBOARDING_STATE,
    ...STORY_ONBOARDING_FILLED,
    step: onboardingStepIndex(stepId),
    ...overrides,
  };
}

export function OnboardingStoryShell({
  initial,
  children,
  width = 390,
  minHeight = 720,
  brand = false,
}: {
  initial: Partial<OnboardingState>;
  children: ReactNode;
  width?: number;
  minHeight?: number;
  /** Welcome step uses the fixed deep-plum brand ground. */
  brand?: boolean;
}) {
  return (
    <OnboardingProvider initial={initial}>
      <div
        style={{
          width,
          maxWidth: "100%",
          minHeight,
          background: brand ? "var(--primary-deep)" : "var(--bg)",
        }}
      >
        {children}
      </div>
    </OnboardingProvider>
  );
}
