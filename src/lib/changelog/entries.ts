/**
 * Shared changelog data for the "What's new in Suppr" surface.
 *
 * Cross-platform contract: **one source of truth** for both mobile
 * (`apps/mobile/app/whats-new.tsx`) and web (`app/whats-new/page.tsx`).
 * Both platforms resolve the latest entry at render time via
 * `getLatestChangelog()` — no network fetch, no runtime config.
 *
 * Author workflow for adding a new build entry lives in
 * `docs/changelog/README.md`. The human-readable markdown under
 * `docs/changelog/builds/build-{N}.md` is the source document for
 * release notes; the array at the bottom of this file mirrors those
 * bullets into the type-checked shape the surface renders.
 *
 * Copy rules:
 *   - Plain English, under 120 chars per bullet.
 *   - No file paths, no TestFlight IDs, no ASC feedback IDs — this
 *     is tester-facing, not engineering-facing.
 *   - Tester attribution never names individuals; it is always a
 *     count ("Shaped by TestFlight feedback from N testers.").
 */

export type ChangelogItemKind = "fixed" | "new" | "coming_soon";

export type ChangelogItem = {
  kind: ChangelogItemKind;
  text: string;
};

export type ChangelogEntry = {
  buildNumber: number;
  /** Semver app version, e.g. "1.0.0". Pairs with `buildNumber` in the
   *  header line (`Build 10 (1.0.0 #10)`). */
  appVersion: string;
  /** ISO date (YYYY-MM-DD) the build was promoted to TestFlight. */
  releaseDate: string;
  /** Optional 1-sentence release headline (audit Group A Feature 4 #1,
   *  2026-05-12). Rendered as a subtitle under the build-number on
   *  `/whats-new` so the release reads as a story, not a bullet dump.
   *  Linear changelog format. Keep under ~80 chars. Omit when there's
   *  no single overarching theme (maintenance-only builds). */
  releaseTitle?: string;
  /** Optional footer line: "Shaped by TestFlight feedback from N testers."
   *  Set only when the build actually closed tester-reported items.
   *  Omit for maintenance / infra-only builds. */
  testerAttribution?: string;
  items: ChangelogItem[];
};

/** Hard limit — matches the copy rule in `docs/changelog/README.md`.
 *  Exported for the unit test + future authoring tools. */
export const CHANGELOG_BULLET_MAX_CHARS = 120;

/**
 * All published changelog entries, newest first. The UI reads
 * `getLatestChangelog()` almost always; `getAllChangelogs()` exists
 * so a future "archive" tab can list prior builds without a second
 * data path.
 *
 * Entries are stored newest-first by convention; the accessors
 * re-sort defensively so an out-of-order addition still renders
 * correctly. Never trim the array — keep the full history.
 */
const CHANGELOGS: ChangelogEntry[] = [
  {
    // EAS auto-increments buildNumber on each cloud build. The 12 →
    // 49 jump happened across iterative production/preview builds
    // between 2026-05-02 and 2026-05-12. The number Grace sees in
    // TestFlight is the EAS-minted one, so the changelog mirrors it
    // for traceability — even though only the items shipped under
    // that build are user-facing.
    buildNumber: 49,
    appVersion: "1.0.0",
    releaseDate: "2026-05-12",
    releaseTitle:
      "Premium-bar polish — 26 visible upgrades from the 2026-05-12 internal audit.",
    // No testerAttribution — this build was driven by the 2026-05-12
    // internal premium-bar audit, not direct tester feedback. The
    // attribution field is reserved for builds that close out
    // tester-reported items.
    items: [
      {
        kind: "fixed",
        text: "Ruler-drag on Welcome no longer crashes on iOS 18 simulators (Reanimated worklet bridge fix).",
      },
      {
        kind: "fixed",
        text: "Refreshing your plan from Settings now skips the Welcome screen and shows a REFRESH PLAN pill so you know you're not onboarding again.",
      },
      {
        kind: "fixed",
        text: "\"Build my plan\" CTA now reads \"Refresh my plan\" when you're rebuilding from Settings.",
      },
      {
        kind: "fixed",
        text: "The Mediterranean wrap option no longer overflows its card.",
      },
      {
        kind: "fixed",
        text: "Onboarding data-bridges step no longer says \"Suppr never writes\" — we do write meal macros to Apple Health when you allow it.",
      },
      {
        kind: "new",
        text: "Reveal step ends with an anticipation beat, haptic confirmation, and a 3-step \"what happens next\" card.",
      },
      {
        kind: "new",
        text: "The Today / Recipes / Plan / More tab now reads \"More\" instead of \"You\".",
      },
      {
        kind: "fixed",
        text: "Calorie ring colour mapping is now 3-state app-wide: gradient when you haven't logged, green when you're under, red when you're over. Daily Calories chart on Progress mirrors the same rule.",
      },
      {
        kind: "new",
        text: "Daily Calories chart on Progress (mobile + web) now has a dashed target line and a colour legend so you can read at a glance which day went over.",
      },
      {
        kind: "new",
        text: "Weight chart on Progress now mirrors Withings Health Mate: always-on smoothed trend line, hollow rings on measurements, a vertical \"today\" indicator, range-aware x-axis ticks, kg unit label.",
      },
      {
        kind: "new",
        text: "Recipe verify now shows a skeleton screen with status narration (Reading → Matching → Scaling), a cancel button, an 8-second slow-load nudge, and a per-row confidence bar.",
      },
      {
        kind: "new",
        text: "Food search now shows your last 5 logged foods on the empty state — one tap to re-log.",
      },
      {
        kind: "new",
        text: "Recipe import is now multi-source: paste link, photo of a recipe page, or manual entry — with clipboard URL auto-detection.",
      },
      {
        kind: "new",
        text: "Notification permission prompt now has a 3-bullet value ladder so you know why we're asking.",
      },
      {
        kind: "fixed",
        text: "Cookie banner on web shrinks to a single-line bottom strip — no more eating 25% of the mobile-web viewport.",
      },
      {
        kind: "fixed",
        text: "Reset modal now uses scannable ✓/✗ bullets and a \"type RESET to confirm\" gate before clearing your data.",
      },
      {
        kind: "fixed",
        text: "Onboarding redirect from /onboarding-v2 → /onboarding no longer flashes a blank chrome frame.",
      },
      {
        kind: "fixed",
        text: "Today desktop hero stat tiles no longer get truncated by the REMAINING/CONSUMED chip — the chip moved into its own header row.",
      },
      {
        kind: "fixed",
        text: "What's new page (web) shows every release with semantic NEW/FIXED/COMING SOON chips and a \"Latest\" pill on the top entry.",
      },
      {
        kind: "fixed",
        text: "/today, /recipes, /library, /discover, /plan, /progress, /shopping, /settings, /notifications URLs no longer 404 — they all route to the right tab.",
      },
      {
        kind: "fixed",
        text: "Paywall now leads with \"Try Pro free for 7 days\" when a trial applies, and the vestigial \"MOST POPULAR\" badge is gone (Pro is the only paid tier).",
      },
      {
        kind: "fixed",
        text: "Today header drops the small-caps date eyebrow when the h1 already says \"Today\" — and the day strip's \"Today\" jump pill hides when you're already on today.",
      },
      {
        kind: "fixed",
        text: "Macro tiles on Today now have a chevron-right affordance so they read as tappable.",
      },
      {
        kind: "fixed",
        text: "Reveal title is now \"Your plan is ready.\" — leads with the win, not the dashboard.",
      },
      {
        kind: "fixed",
        text: "Plan tab eyebrow shows the actual date range (e.g. \"May 7 – 13 · Meal plan\") instead of a generic \"This week\".",
      },
      {
        kind: "fixed",
        text: "Move-meal sheet now shows the source meal (\"From: Breakfast · Thu · Tofu poke bowl\") so you can confirm which row you grabbed.",
      },
    ],
  },
  // Placeholder for the next build. Kept deliberately empty so a
  // renderer that fetches "latest" before new bullets land doesn't
  // break; `getLatestChangelog()` prefers the most recent entry that
  // actually has items, falling back to the placeholder only if
  // nothing shipped yet.
  {
    buildNumber: 12,
    appVersion: "1.0.0",
    releaseDate: "2026-05-02",
    items: [
      {
        kind: "new",
        text: "Tap \"View all nutrients\" on Today to see every vitamin and mineral against the FDA Daily Value, sorted by %DV.",
      },
      {
        kind: "new",
        text: "Tap the pill under your calorie ring on Today to see why today's target is what it is.",
      },
      {
        kind: "fixed",
        text: "Recipe page calories are now on their own headline line, and the macro tiles all share width on a single row.",
      },
      {
        kind: "fixed",
        text: "Library filter pills no longer have text squished against the border — taller, more breathable taps.",
      },
    ],
  },
  {
    buildNumber: 11,
    appVersion: "1.0.0",
    releaseDate: "2026-04-20",
    items: [
      {
        kind: "fixed",
        text: "Recipe page now reads cleaner. Calories sit inline with the meal type and serves, macro tiles are bigger, and empty prep/cook times disappear.",
      },
    ],
  },
  {
    buildNumber: 10,
    appVersion: "1.0.0",
    releaseDate: "2026-04-19",
    testerAttribution: "Shaped by TestFlight feedback from 8 testers.",
    items: [
      { kind: "fixed", text: "Apple Sign-In now works for everyone." },
      {
        kind: "fixed",
        text: "Food search now shows natural servings for branded and restaurant items (e.g. 1 sandwich, 230 g).",
      },
      {
        kind: "fixed",
        text: "Create custom food now captures serving size, sugar, saturated fat, sodium, and barcode.",
      },
      {
        kind: "new",
        text: "Weekly recap push notifications are now live (delivered on Saturday and Sunday evenings).",
      },
      {
        kind: "fixed",
        text: "Keyboard no longer covers the submit button on Login, Signup, Weight tracker, and others.",
      },
      {
        kind: "fixed",
        text: "Imported recipes now show their source at the bottom of the page.",
      },
      {
        kind: "new",
        text: "Activity level can now be changed in Settings with a live TDEE preview.",
      },
      {
        kind: "fixed",
        text: "Household no longer fails to load with a multiple-rows error.",
      },
      {
        kind: "fixed",
        text: "Recipe instructions placeholder now renders a real newline between steps.",
      },
      {
        kind: "coming_soon",
        text: "Paywall clearly says \"Trial unavailable in this build\" until IAP provisioning lands.",
      },
    ],
  },
];

/**
 * Returns the most recent changelog entry that has at least one
 * bullet. Falls back to the newest placeholder if nothing has
 * shipped yet — which can only happen in local dev before build 10.
 *
 * Defensive sort so out-of-order additions still render correctly.
 */
export function getLatestChangelog(): ChangelogEntry {
  const sorted = [...CHANGELOGS].sort((a, b) => b.buildNumber - a.buildNumber);
  const withItems = sorted.find((e) => e.items.length > 0);
  if (withItems) return withItems;
  // No shipped build — return the newest placeholder so the UI has
  // a valid header to render. This branch only fires in pre-build-10
  // local dev and is covered by a unit test guard.
  return sorted[0];
}

/** Returns all entries, newest first. Never mutated. */
export function getAllChangelogs(): ChangelogEntry[] {
  return [...CHANGELOGS].sort((a, b) => b.buildNumber - a.buildNumber);
}

/** Human label for a category heading on the What's new surface.
 *  Kept here so mobile + web render identical copy. */
export function changelogKindLabel(kind: ChangelogItemKind): string {
  switch (kind) {
    case "fixed":
      return "Fixed";
    case "new":
      return "New";
    case "coming_soon":
      return "Coming soon";
  }
}

/** Group an entry's items by kind, preserving the canonical order
 *  (`new` → `fixed` → `coming_soon`) so both platforms render the
 *  same section sequence. */
export function groupChangelogItems(
  entry: ChangelogEntry,
): { kind: ChangelogItemKind; items: ChangelogItem[] }[] {
  const order: ChangelogItemKind[] = ["new", "fixed", "coming_soon"];
  return order
    .map((kind) => ({
      kind,
      items: entry.items.filter((i) => i.kind === kind),
    }))
    .filter((g) => g.items.length > 0);
}
