# Decision — Mobile Settings structural fix (single shell)

**Date:** 2026-05-01
**Area:** Mobile / Settings IA + visual language
**Status:** Resolved
**Branch:** `claude/settings-mobile-structural-fix`

## Decision

`/(tabs)/settings.tsx` collapses to a single shell with three jobs
only: render the search input, mount `<SettingsBundleContent>`, and
render a single neutral Sign Out row beneath. Every legacy in-file
section (Plan / Appearance / Account / Body & activity / Journal
display / Notifications / Tracking extras / About / Data) is deleted
because they duplicated the bundle and shipped with three different
visual languages on one scroll. The bundle absorbs:

- Tracking extras (caffeine + alcohol Today opt-in) into a new
  "Display & extras" section.
- Manage subscription row + promo-code redemption into the
  Membership card so base/pro users can cancel and testers can
  redeem codes.

CSV export now writes to the iOS cache directory and surfaces the
share sheet via `Share.share({ url: file:// })` — the legacy
`Share.share({ message: csv })` silently truncates above ~64KB on
iOS pasteboard.

`/household-settings.tsx` swaps every Ionicons usage to
lucide-react-native so the Settings flow renders in one icon family.

## Why

Pre-fix `/(tabs)/settings` rendered TWO settings shells stacked: a
legacy in-file set of sections AND `<SettingsBundleContent>` directly
underneath. The result was the single biggest "feels prototype-tier"
blocker on the app:

- **Duplicate rows.** Sign Out twice (one red-bordered destructive,
  one neutral). Export nutrition log (CSV) twice. Export everything /
  Export all data (JSON) overlap.
- **Inconsistent visual language.** The legacy in-file sections used
  the segmented-control / Switch pattern from the pre-2026-04-28 IA,
  the bundle uses the Claude Design prototype card+icon pattern, and
  the search input on top used the emoji magnifying-glass character
  in a sea of lucide strokes.
- **Broken CSV export.** The legacy CSV row called
  `Share.share({ message: csv })` which routes through the iOS
  pasteboard. Above ~64KB iOS silently truncates — a real user with
  a few months of logs hits the limit on day 1, sees a partial export
  saved to Notes, and assumes their data is gone.
- **Wrong Apple Health state.** The bundle's row showed "Connected"
  whenever HealthKit was platform-available, regardless of whether
  the user had granted permission. A brand-new install on iOS saw
  "Connected" before the permission sheet ever opened.

The bundle is already the canonical body on `/(tabs)/more` (a
redirect to `/(tabs)/settings` post-Batch-D). Keeping a parallel
in-file shell on `/settings` was the temp-parity artefact memory
`feedback_no_quick_temp_fixes.md` warns against.

## Changes

### Code

- `apps/mobile/app/(tabs)/settings.tsx` — rewritten to ~190 lines (was
  ~1340). Renders only: header, title, search input (with lucide
  `Search`), `<SettingsBundleContent>`, single neutral Sign Out row.
- `apps/mobile/components/settings/SettingsBundleContent.tsx`
  - Adds Display & extras section with caffeine + alcohol toggles.
  - CSV export row writes the file via `expo-file-system`'s
    `writeAsStringAsync` then surfaces the share sheet via
    `Share.share({ url: fileUri })`. Mirrors `lib/exportEverything.ts`.
  - Apple Health row reflects real permission state by re-probing
    HealthKit on focus via `probeHealthAccess()`. States:
    Connected / Permission needed · tap to fix / Not available on
    this device / Checking…
  - Membership card absorbs Manage subscription row +
    promo-code input.
  - Erase-everything alert uses calm-streak copy: "Delete your data
    and start fresh? You can re-import from your export file
    anytime…" Drops the "permanently delete / cannot be undone"
    double-pattern.
  - Delete-account retry copy drops the "(lowercase)" hint — the
    compare already lowercases the typed input.
  - Drops the bundle's red-bordered Sign Out (single row now lives
    in the parent settings screen).
  - `SettingsRow` auto-applies `fontVariant: ['tabular-nums']` to
    sub copies that contain a digit (caffeine mg/day, alcohol
    g/week, build marker).
- `apps/mobile/app/household-settings.tsx` — Ionicons → lucide swap.
  8 glyphs (chevron-back / add / chevron-forward / cafe-outline /
  restaurant-outline / moon-outline / nutrition-outline / checkmark).

### Tests

- `apps/mobile/tests/unit/settingsScreenIntegration.test.tsx` (new) —
  pins single CSV row, no Ionicons, lucide Search, single Sign Out,
  no legacy section titles.
- `apps/mobile/tests/unit/settingsBundleExport.test.ts` (new) — pins
  `Share.share({ url })` everywhere; no `Share.share({ message })`.
- `apps/mobile/tests/unit/householdSettingsLucideSwap.test.ts` (new)
  — pins the 8 lucide replacements in /household-settings.
- `apps/mobile/tests/unit/settingsSearch.test.ts` — re-anchored to
  the single shell (no legacy section gates).
- `apps/mobile/tests/unit/settingsSignOutNeutralColor.test.ts` —
  re-anchored to the single neutral row beneath the bundle.
- `apps/mobile/tests/unit/settingsBundleParity.test.ts` — drops
  `settings-bundle-sign-out` testID, adds the new
  `settings-bundle-track-{caffeine,alcohol}-toggle` /
  `settings-manage-subscription-row` /
  `settings-bundle-promo-code-{input,apply}` IDs, accepts the
  calm-streak title for the erase-everything alert.

### Docs

- This decision doc.

## Web parity

Mobile decisions apply to web too (memory
`feedback_mobile_decisions_apply_to_web.md`). The matching web
Settings pass is a separate executor — this PR doesn't touch web. The
mobile changes don't introduce any pattern web can't mirror:

- Single shell + canonical section list — already the web Settings
  layout direction per the 2026-04-28 Group G IA collapse decision.
- File-write CSV export → web equivalent is a `<a download>` anchor
  on a Blob URL; same pattern as the existing web export-everything
  flow.
- Apple Health row → web has no HealthKit row.
- Calm-streak erase copy → mobile and web should mirror the same
  alert / dialog copy. Web pass should adopt the same wording.
- Lucide swap → web is already lucide-react.

## Validation

- Mobile typecheck passes (`npx tsc --noEmit` in `apps/mobile`).
- Settings renders one shell, one Sign Out, one CSV row, one JSON
  row (now "Export everything"), one icon family.
- CSV export writes to cache and opens the share sheet — same
  mechanism the export-everything flow already uses in production.
- Apple Health row reflects real permission state (probe on focus).

## Risks / follow-ups

- **Activity-level inline edit.** The legacy in-file Body & activity
  section had an inline activity-level picker modal. Post-fix the
  user reaches activity level via the bundle's "Daily targets" row
  → /targets → activity_level field. /targets currently READS the
  field but doesn't expose an inline editor. Follow-up: file a row
  on the targets screen for activity-level edit. Owner:
  `ui-product-designer`.
- **Theme picker.** Pre-fix the legacy Appearance section had a
  segmented control for Automatic / Light / Dark. The bundle has
  no theme row; the IA decision (2026-04-28) lists Appearance as a
  bundle section but it hasn't shipped yet. Follow-up: add an
  Appearance row to the bundle. Owner: `ui-product-designer`.
- **Notification toggles.** Pre-fix the legacy Notifications section
  had granular toggles for new recipes / meal reminders / weekly
  summary / creator updates. Post-fix the bundle's Notifications row
  routes to `/(tabs)/notifications`; that screen owns the toggles.
  Verify the toggles all exist on /notifications.
- **Web parity sweep.** Web Settings still ships the duplicate
  layout. Owner: parallel executor (already in flight on
  `claude/settings-web-parity-fix`).
