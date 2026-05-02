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
  // Placeholder for the next build. Kept deliberately empty so a
  // renderer that fetches "latest" before new bullets land doesn't
  // break; `getLatestChangelog()` prefers the most recent entry that
  // actually has items, falling back to the placeholder only if
  // nothing shipped yet.
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
