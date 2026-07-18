/**
 * Settings search index — 2026-05-02
 * (`claude/fasting-findable-urgent`).
 *
 * Pre-fix the Settings screen's search box was a "hide bundle / show
 * empty state" gate: any non-empty query rendered a `"No matches
 * for 'X'"` line and nothing else. Build 40 testers reported typing
 * "fast" → no matches, with no other in-app way to find the fasting
 * preferences. This file ships a lightweight keyword index so the
 * common routable Settings destinations are actually findable.
 *
 * Scope is intentionally narrow:
 *   - Only entries that route to a *full screen* (not a modal-on-top
 *     row) are indexed — the user reading a search result expects
 *     a tap to take them somewhere they can configure the thing.
 *   - In-bundle modal rows (caffeine/alcohol target pickers, week
 *     start picker, dashboard-widget picker) are intentionally NOT
 *     indexed yet because tapping a search hit can't open a modal
 *     that lives in `<SettingsBundleContent>` — fixing that is a
 *     separate, larger refactor.
 *   - Toggles (Track caffeine, Track alcohol, Net carbs lens) are
 *     also not indexed for the same reason.
 *
 * Adding a new entry:
 *   1. Append to `SETTINGS_SEARCH_INDEX` with a stable `id`.
 *   2. List every reasonable keyword the user might type — go wide;
 *      the matcher is substring-based.
 *   3. Provide a route the parent screen will `router.push` on tap.
 *   4. Add a unit test in `tests/unit/settingsSearchIndex.test.ts`
 *      asserting the new keyword surfaces the new row.
 */

export type SettingsSearchEntry = {
  id: string;
  label: string;
  sub: string;
  /** Substring keywords (lowercased before match). Wider is better. */
  keywords: string[];
  /** Section the row lives under in the canonical bundle. */
  section: string;
  /** Expo-Router pathname to push on tap. */
  route: string;
};

export const SETTINGS_SEARCH_INDEX: readonly SettingsSearchEntry[] = [
  {
    id: "fasting",
    label: "Intermittent fasting",
    sub: "Pick your fast / eat window (16:8, 18:6, 20:4, 14:10, OMAD)",
    section: "Goals & targets",
    keywords: [
      "fast",
      "fasting",
      "intermittent",
      "intermittent fasting",
      "fasting window",
      "fasting target",
      "fasting hours",
      "fasting timer",
      "fast hours",
      "eat window",
      "if",
      "16:8",
      "18:6",
      "20:4",
      "14:10",
      "23:1",
      "omad",
      "one meal a day",
    ],
    route: "/fasting",
  },
  {
    id: "daily-targets",
    label: "Daily targets",
    sub: "Calories, protein, carbs, fat, fibre",
    section: "Goals & targets",
    keywords: [
      "target",
      "targets",
      "daily target",
      "calorie",
      "calories",
      "kcal",
      "macro",
      "macros",
      "protein",
      "carbs",
      "carbohydrate",
      "fat",
      "fiber",
      "fibre",
      "goal",
      "goals",
    ],
    route: "/targets",
  },
  {
    id: "notifications",
    label: "Notifications",
    sub: "Push reminders, weekly recap timing",
    section: "Connections",
    keywords: [
      "notification",
      "notifications",
      "push",
      "reminder",
      "reminders",
      "alert",
      "alerts",
      "recap",
      "weekly recap",
    ],
    route: "/(tabs)/notifications",
  },
  {
    id: "health-sync",
    label: "Apple Health",
    sub: "HealthKit sync — weight, steps, workouts",
    section: "Connections",
    keywords: [
      "health",
      "healthkit",
      "apple health",
      "sync",
      "steps",
      "workout",
      "workouts",
      "weight sync",
      "activity",
    ],
    route: "/health-sync",
  },
  {
    // ENG-955 — gentle, opt-in weigh-in reminder. The row lives in the
    // Reminders card of the canonical Settings bundle and is gated by the
    // default-OFF `weigh_in_reminder_v1` flag, so a hit routes to the
    // Settings screen (where the row renders once the flag ramps) rather than
    // to a standalone screen.
    id: "weigh-in-reminder",
    label: "Weigh-in reminder",
    sub: "A gentle weekly weigh-in nudge — skipped if you've already weighed in",
    section: "Reminders",
    keywords: [
      "weigh",
      "weigh in",
      "weigh-in",
      "weighin",
      "weight reminder",
      "weigh in reminder",
      "scale",
      "scale reminder",
      "weekly weigh",
      "remind me to weigh",
    ],
    route: "/settings",
  },
];

/**
 * Filter the index against a user query. Match rules:
 *   - Trim + lowercase the query.
 *   - Empty query → empty array (caller renders the canonical body).
 *   - Otherwise return entries where ANY of `label`, `sub`,
 *     `section`, or one of the `keywords` contains the query as a
 *     substring (case-insensitive).
 *
 * This is deliberately permissive — the alternative (whole-word /
 * fuzzy / typo-tolerant matching) is more expensive and the input
 * domain is small enough that substring-on-keywords is good enough
 * for "find the fasting row by typing 'fast'".
 */
export function filterSettingsIndex(
  query: string,
  index: readonly SettingsSearchEntry[] = SETTINGS_SEARCH_INDEX,
): readonly SettingsSearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  return index.filter((entry) => {
    if (entry.label.toLowerCase().includes(q)) return true;
    if (entry.sub.toLowerCase().includes(q)) return true;
    if (entry.section.toLowerCase().includes(q)) return true;
    for (const k of entry.keywords) {
      if (k.toLowerCase().includes(q)) return true;
    }
    return false;
  });
}
