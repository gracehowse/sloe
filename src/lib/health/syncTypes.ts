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
 * ─── Current UI status (2026-07-21, re-confirmed in ENG-1635) ──────────
 * Neither platform's real settings screen renders from this list.
 * Mobile's `apps/mobile/app/health-sync.tsx` hand-codes its own five
 * `HealthCategoryRow`s (steps/weight/active energy/resting energy/
 * workouts) rather than mapping over `HEALTH_SYNC_TYPES`; there is no
 * `app/settings/health/page.tsx` on web at all. ENG-1635 found this
 * SSOT's only other consumer (`apps/mobile/lib/healthSyncTypePrefs.ts`,
 * a per-type toggle storage layer) had zero live callers of its own and
 * deleted it rather than build the settings screen it was scaffolding
 * for — Grace's call: no evidence of demand for granular per-type sync
 * control, and the all-or-nothing Connect Health toggle works today.
 * This SSOT list itself stays (real, tested spec — ENG-1584 pins
 * `sleep`'s `supported` flag against it) for the real feature, tracked
 * separately as ENG-1644 if it's ever picked up. Until then,
 * `supported`/`defaultOn` describe what a *future* renderer should
 * show, not live UI state — don't assume flipping a value here changes
 * anything a user sees today.
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

// ENG-1635 (2026-07-21) — removed `defaultHealthSyncTypePrefs()` and its
// sole consumer `apps/mobile/lib/healthSyncTypePrefs.ts` (the whole
// per-type toggle storage layer — getHealthSyncTypePrefs/
// setHealthSyncTypePref/markHealthSyncedNow/getHealthLastSyncAt/
// relativeTimeAgo). Confirmed zero live callers for any export in that
// file (not just the toggle prefs — the "last synced" helpers its own
// header claimed feed the Connected card were unused too). Decided not
// to build the real settings UI now (no evidence of user demand for
// granular per-type control; Connect Health's current all-or-nothing
// toggle works); tracked as a genuine future feature in ENG-1644 rather
// than leaving live dead code as if the decision were still open. This
// SSOT list stays — it's real, tested spec (ENG-1584 pins `sleep`'s
// `supported` flag against it) for whenever ENG-1644 is picked up.
//
// ENG-1469 (2026-07-08) — removed the dead `HEALTH_SYNC_FOOTNOTE` export.
// It had zero importers (neither `app/settings/health/page.tsx` nor
// `apps/mobile/app/health-sync.tsx` ever rendered it — both screens use
// their own inline footnote copy), and the "parity test pins this
// string" comment referenced a `tests/unit/healthSyncTypesParity.test.ts`
// that does not exist in the repo. Verified dead, not deferred — per
// no-silent-deferrals, deleting rather than leaving a stale claim.
