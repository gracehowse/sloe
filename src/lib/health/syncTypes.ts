/**
 * Apple Health sync types — shared SSOT for web and mobile.
 *
 * This file owns the canonical list of six Apple Health data types +
 * whether each is actually wired into `syncHealthData` today
 * (`supported`) + its default opt-in state (`defaultOn`).
 *
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/ux/claude-design-bundles/prototype/project/flows.jsx`, `HealthPage`).
 *
 * ─── Current UI status (2026-07-21) ────────────────────────────────────
 * Neither platform's real settings screen renders from this list yet.
 * Mobile's `apps/mobile/app/health-sync.tsx` hand-codes its own five
 * `HealthCategoryRow`s (steps/weight/active energy/resting energy/
 * workouts) rather than mapping over `HEALTH_SYNC_TYPES`; there is no
 * `app/settings/health/page.tsx` on web at all. The per-type toggle
 * persistence layer that DOES consume this file
 * (`apps/mobile/lib/healthSyncTypePrefs.ts`) has no UI caller either —
 * see that file's header for detail. In other words: this SSOT is
 * prepared for a future settings screen that renders one row per
 * `HEALTH_SYNC_TYPES` entry, but that screen doesn't exist yet
 * (ENG-1635). Until it does, `supported`/`defaultOn` here describe what
 * a *future* renderer should show, not live UI state — don't assume
 * flipping a value here changes anything a user sees today.
 *
 * ─── Why an SSOT anyway? ────────────────────────────────────────────────
 * When that settings screen is built, web and mobile should render the
 * same rows in the same order with the same labels — this file is the
 * one place that ordering/labelling/support-state is decided so the two
 * platforms can't drift when someone builds it. There is currently no
 * automated parity test pinning this order/labels — an earlier version
 * of this comment claimed one existed (`tests/unit/healthSyncTypesParity.test.ts`),
 * but it was never written (see the ENG-1469 footer note below, which
 * already found and removed a dead export referencing the same
 * nonexistent file, but didn't correct this claim). No new test is
 * added here either: with zero live renderers of this list on either
 * platform, a "row order/label parity" test would only pin the array
 * literal against itself. Revisit once a real settings screen consumes
 * this file.
 *
 * ─── The `supported` field ─────────────────────────────────────────────
 * Governs whether a future row's toggle would be a real opt-in or a
 * disabled "Coming soon" placeholder (project rule: no UI element with
 * no real backing logic). `Sleep` was the only `supported: false` entry
 * — `apps/mobile/lib/healthSync.ts` didn't read `SleepAnalysis` samples.
 * ENG-1584 wired that read (+ per-day asleep-minutes aggregation in
 * `apps/mobile/lib/healthSyncSleep.ts`), so every entry below is now
 * `supported: true`. Add a future type as `supported: false` (+
 * `defaultOn: false`) if its settings row ships before its sync logic.
 */

/** Canonical key used to persist a per-type preference (AsyncStorage on
 *  mobile, localStorage on web). `_v1` suffix lets us migrate the shape
 *  later without clobbering existing user prefs. */
export type HealthSyncTypeKey =
  | "activeEnergy"
  | "restingEnergy"
  | "steps"
  | "bodyWeight"
  | "workouts"
  | "sleep";

/** Icon semantic name from the shared icon maps — `ui/icons.ts` on web
 *  (lucide) and the `Ionicons` glyph name on mobile. The web/mobile
 *  glyphs render the same shape; names differ because the glyph sets
 *  themselves differ. */
export interface HealthSyncTypeDef {
  /** Stable storage key. Never rename — migrations depend on it. */
  key: HealthSyncTypeKey;
  /** User-facing row label. Matches prototype copy verbatim. */
  label: string;
  /** Lucide icon name from `src/app/components/ui/icons.ts` (web). */
  webIcon:
    | "energy"
    | "heartPulse"
    | "footprints"
    | "streak"
    | "scale"
    | "dumbbell"
    | "bed"
    | "darkMode";
  /** Ionicons name for `apps/mobile/app/health-sync.tsx`. */
  mobileIcon:
    | "flame-outline"
    | "pulse-outline"
    | "footsteps-outline"
    | "scale-outline"
    | "barbell-outline"
    | "moon-outline";
  /** Whether `syncHealthData` currently writes this type into Supabase
   *  when the toggle is on. `false` means the toggle is rendered
   *  disabled with a "Coming soon" caption. */
  supported: boolean;
  /** Whether the toggle defaults ON for users who have not yet opened
   *  this screen. Mirrors the prototype default state. */
  defaultOn: boolean;
}

/** Display order matches the prototype top-to-bottom. No parity test
 *  pins this order yet (see the file header) — a reorder here is safe
 *  today, but will need a real parity test once a settings screen
 *  actually renders this list. */
export const HEALTH_SYNC_TYPES: readonly HealthSyncTypeDef[] = [
  {
    key: "activeEnergy",
    label: "Active energy",
    webIcon: "energy",
    mobileIcon: "flame-outline",
    supported: true,
    defaultOn: true,
  },
  {
    key: "restingEnergy",
    label: "Resting energy",
    webIcon: "heartPulse",
    mobileIcon: "pulse-outline",
    supported: true,
    defaultOn: true,
  },
  {
    key: "steps",
    label: "Steps",
    webIcon: "streak",
    mobileIcon: "footsteps-outline",
    supported: true,
    defaultOn: true,
  },
  {
    key: "bodyWeight",
    label: "Body weight",
    webIcon: "scale",
    mobileIcon: "scale-outline",
    supported: true,
    defaultOn: true,
  },
  {
    key: "workouts",
    label: "Workouts",
    webIcon: "dumbbell",
    mobileIcon: "barbell-outline",
    supported: true,
    defaultOn: true,
  },
  {
    key: "sleep",
    label: "Sleep",
    webIcon: "darkMode",
    mobileIcon: "moon-outline",
    // ENG-1584 — `SleepAnalysis` is read by `syncHealthData` via
    // `apps/mobile/lib/healthSyncSleep.ts` (minutes actually asleep per
    // local day; see that file for the value-taxonomy + overlap-merge
    // handling). `defaultOn: true` to match every other supported entry.
    supported: true,
    defaultOn: true,
  },
] as const;

/** Default preferences map — what a brand new user sees before they
 *  flip anything. Unsupported types always default off. */
export function defaultHealthSyncTypePrefs(): Record<HealthSyncTypeKey, boolean> {
  const out = {} as Record<HealthSyncTypeKey, boolean>;
  for (const t of HEALTH_SYNC_TYPES) {
    out[t.key] = t.supported && t.defaultOn;
  }
  return out;
}

// ENG-1469 (2026-07-08) — removed the dead `HEALTH_SYNC_FOOTNOTE` export.
// It had zero importers (neither `app/settings/health/page.tsx` nor
// `apps/mobile/app/health-sync.tsx` ever rendered it — both screens use
// their own inline footnote copy), and the "parity test pins this
// string" comment referenced a `tests/unit/healthSyncTypesParity.test.ts`
// that does not exist in the repo. Verified dead, not deferred — per
// no-silent-deferrals, deleting rather than leaving a stale claim.
