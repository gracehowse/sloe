import type { OnboardingNudge, OnboardingNudgeId } from "./types";

/**
 * Static nudge catalogue, declared in priority order.
 *
 * The order in this array IS the priority order — the first nudge that
 * passes its eligibility + cooldown + removed gates is rendered.
 * Reordering here changes which prompt the user sees first when
 * multiple are eligible.
 *
 * Wave-2 (2026-04-30 audit-vs-competitors): re-ordered from
 * permissions → import → recipes to **import → recipes → permissions**.
 *
 * Reason: asking for HealthKit BEFORE the user has felt the value of
 * logging is the highest-blow-rate prompt in the queue. Cal AI defers
 * HK until after the first food log for exactly this reason. Each
 * nudge now also carries a runtime `eligibility` predicate so we
 * surface the right one at the right moment, not just the highest
 * priority one that happens to be eligible by cooldown alone:
 *
 * - `import` — show first while the library is sparse (< 3 saved
 *   recipes). Importing one recipe seeds the library in the most
 *   concrete way: the user sees their own content.
 * - `recipes` — second while the library is small (< 5 saved). A
 *   lower-stakes browse + pick action.
 * - `permissions` — third, and only after the user has felt the value
 *   (>= 3 lifetime meal logs). The OS-prompt blow-rate goes way down
 *   when the user has a track record. We additionally drop this nudge
 *   when the OS has already given us an authoritative answer
 *   (granted / denied) — re-asking past that point is noise.
 *
 * Cooldowns mirror the spec in `docs/decisions/2026-04-30-onboarding-shrink-15-to-12.md`:
 * 7 days for the two near-term nudges and 14 for the recipes browse so
 * we don't re-ask faster than the user typically cooks a fresh week.
 */
export const ONBOARDING_NUDGES: OnboardingNudge[] = [
  {
    id: "import",
    title: "Import recipes from anywhere",
    body: "Paste a link from Instagram, TikTok or any blog.",
    primaryLabel: "Try it",
    cooldownDays: 7,
    removeOnAction: false,
    // Only nudge an import while the library is sparse. Once the user
    // has built up >= 3 saved recipes the import surface is something
    // they discover from the Library tab on their own terms.
    eligibility: (s) => s.libraryCount < 3,
  },
  {
    id: "recipes",
    title: "Seed your week with a few recipes",
    body: "Browse the library to get started.",
    primaryLabel: "Browse",
    cooldownDays: 14,
    removeOnAction: false,
    // Stop browse-prompting once the library has enough variety to
    // generate a balanced week (~5 recipes covers Breakfast / Lunch /
    // Dinner / Snacks with a couple of swaps).
    eligibility: (s) => s.libraryCount < 5,
  },
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
    // Two independent gates:
    //  1. The user must have felt the value of logging — at least 3
    //     lifetime meal entries. Mount-gating already requires
    //     `mealsToday.length >= 1`; this adds the cumulative
    //     "they've come back at least a couple of times" floor.
    //  2. The OS must not have already given an authoritative answer
    //     (granted / denied). If it has, the nudge is permanently
    //     irrelevant — re-asking via this surface is noise.
    eligibility: (s) => {
      // `null` lifetime count = unknown; treat as not-yet-eligible so
      // we never flash a prompt before we've confirmed the threshold.
      if (s.lifetimeMealCount == null) return false;
      if (s.lifetimeMealCount < 3) return false;
      // Permissions status `null` = "we haven't queried yet"; do NOT
      // surface until we know. `undetermined` is the only state where
      // showing the nudge could change anything.
      if (s.notificationsPermissionStatus !== "undetermined") return false;
      return true;
    },
  },
];

/** Look-up by id (test helper / future call sites). */
export function findNudge(id: OnboardingNudgeId): OnboardingNudge | undefined {
  return ONBOARDING_NUDGES.find((n) => n.id === id);
}
