/**
 * Mobile re-export of the shared onboarding seed list.
 * Mirrors `src/lib/onboarding/onboardingSeeds.ts`.
 *
 * Authority: D-2026-04-27-14 + the onboarding-candidate-source decision.
 * Both platforms render the same 15 seeds (web parity rule).
 */
export {
  ONBOARDING_SEEDS,
  SEED_FILTER_FALLBACK_THRESHOLD,
  filterOnboardingSeeds,
  type OnboardingSeed,
  type SeedFilterInput,
} from "@suppr/shared/onboarding/onboardingSeeds";
