import type { Goal } from "./state";

/** Shared goal step copy + thumbnail titles (ENG-895 / Figma 189:2). */
export const ONBOARDING_GOAL_OPTIONS: ReadonlyArray<{
  id: Goal;
  title: string;
  subtitle: string;
  /** Passed to FoodFallbackThumb for deterministic sample imagery. */
  thumbnailTitle: string;
}> = [
  {
    id: "lose",
    title: "Lose weight while still eating what I love",
    subtitle: "Gradual deficit, protein-first",
    thumbnailTitle: "green salad bowl",
  },
  {
    id: "maintain",
    title: "Eat healthier at home",
    subtitle: "Keep things steady",
    thumbnailTitle: "pasta tomato basil",
  },
  {
    id: "gain",
    title: "Build muscle",
    subtitle: "Small surplus, high protein",
    thumbnailTitle: "roast chicken dinner",
  },
  {
    id: "recomp",
    title: "Just track what I cook",
    subtitle: "Slight deficit, strength-focused",
    thumbnailTitle: "berry smoothie",
  },
] as const;

export const ONBOARDING_GOAL_QUESTION = "What brings you to Sloe?";
export const ONBOARDING_GOAL_SUBTITLE = "We'll tailor everything to you.";
