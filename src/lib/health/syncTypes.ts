/**
 * Apple Health sync types — shared SSOT for web and mobile.
 *
 * The Apple Health settings screen (mobile `apps/mobile/app/health-sync.tsx`,
 * web `app/settings/health/page.tsx`) lists six data types the user can opt
 * in or out of per-type. This file owns the canonical list + whether each
 * type is actually wired into `syncHealthData` today.
 *
 * Ported from the 2026-04-19 Claude Design prototype
 * (`docs/ux/claude-design-bundles/prototype/project/flows.jsx`, `HealthPage`).
 *
 * ─── Why an SSOT? ─────────────────────────────────────────────────────
 * Web and mobile render the same rows in the same order with the same
 * labels. Drift between platforms here would mean a user sees "Sleep" on
 * web but not on mobile, or the two in a different order. The parity
 * test (`tests/unit/healthSyncTypesParity.test.ts`) pins the order and
 * labels so future edits can't silently diverge.
 *
 * ─── Why some are `supported: false`? ─────────────────────────────────
 * The prototype shows `Sleep`, but `apps/mobile/lib/healthSync.ts` does
 * not currently read `SleepAnalysis` samples. Per the project rule "no
 * UI element with no real backing logic", `Sleep` is rendered with its
 * toggle visually disabled and a "Coming soon" sub-label rather than
 * being shown as a fully functional opt-in. When the underlying sync is
 * wired, flip `supported` to `true` and the UI lights up automatically.
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

/** Display order matches the prototype top-to-bottom. Do not reorder
 *  without updating the parity test + the mobile screen. */
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
    // `SleepAnalysis` not yet read by `syncHealthData`. Toggle rendered
    // disabled with "Coming soon" caption until wired.
    supported: false,
    defaultOn: false,
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

/** Caption at the bottom of both screens. Verbatim from prototype —
 *  the parity test pins this string. */
export const HEALTH_SYNC_FOOTNOTE =
  "Activity bonus may be added to your calorie target if your total burn exceeds the TDEE estimate. Weight entries from the Health app are rounded to the nearest 0.1 kg.";
