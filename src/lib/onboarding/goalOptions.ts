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
  // ENG-1314 — the neutral tracking intent maps to MAINTENANCE. It used to
  // sit on the `recomp` card, silently assigning a deficit the user never
  // asked for (D&I / trust-posture finding, 2026-07-01 sweep). Recomp keeps
  // its own card because the pipeline is real and distinct (high_protein
  // strategy, 2.2 g/kg, own pace range) — but its title now says what it
  // does to your body, so the deficit is an explicit opt-in.
  {
    id: "maintain",
    title: "Just track what I cook",
    subtitle: "Maintenance — keep things steady",
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
    title: "Lose fat, build strength",
    subtitle: "Slight deficit, protein-first",
    thumbnailTitle: "berry smoothie",
  },
] as const;

export const ONBOARDING_GOAL_QUESTION = "What brings you to Sloe?";
export const ONBOARDING_GOAL_SUBTITLE = "We'll tailor everything to you.";
