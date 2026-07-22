import {
  DEFAULT_ONBOARDING_STATE,
  STEP_IDS,
  type OnboardingState,
  type StepId,
} from "@/lib/onboarding";

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
    step: STEP_IDS.indexOf(stepId),
    ...overrides,
  };
}
