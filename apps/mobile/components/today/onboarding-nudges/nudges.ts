import type { OnboardingNudge, OnboardingNudgeId } from "./types";

/**
 * Static nudge catalogue, declared in priority order.
 *
 * The order in this array IS the priority order — the first nudge that
 * passes its cooldown + removed gates is rendered. Reordering here
 * changes which prompt the user sees first when multiple are eligible.
 *
 * - `permissions` — first because Health connection unlocks adaptive
 *   TDEE refinement (the most useful background signal we ship).
 * - `import` — second because importing one recipe seeds the library
 *   in the most concrete way: the user sees their own content.
 * - `recipes` — third because seeding from the public library is a
 *   lower-stakes browse + pick action.
 *
 * Cooldowns mirror the spec in `docs/decisions/2026-04-30-onboarding-shrink-15-to-12.md`:
 * 7 days for the two near-term nudges and 14 for the lower-priority
 * recipes browse so we don't re-ask faster than the user typically
 * cooks a fresh week.
 */
export const ONBOARDING_NUDGES: OnboardingNudge[] = [
  {
    id: "permissions",
    title: "Connect Apple Health?",
    body: "We'll sync workouts and weight automatically.",
    primaryLabel: "Connect",
    cooldownDays: 7,
    // Once the user has answered the OS prompt (granted OR denied), we
    // do not re-ask via this nudge — the system answer is authoritative.
    // Settings always exposes a way to flip it later.
    removeOnAction: true,
  },
  {
    id: "import",
    title: "Import recipes from anywhere",
    body: "Paste a link from Instagram, TikTok or any blog.",
    primaryLabel: "Try it",
    cooldownDays: 7,
    removeOnAction: false,
  },
  {
    id: "recipes",
    title: "Seed your week with a few recipes",
    body: "Browse the library to get started.",
    primaryLabel: "Browse",
    cooldownDays: 14,
    removeOnAction: false,
  },
];

/** Look-up by id (test helper / future call sites). */
export function findNudge(id: OnboardingNudgeId): OnboardingNudge | undefined {
  return ONBOARDING_NUDGES.find((n) => n.id === id);
}
