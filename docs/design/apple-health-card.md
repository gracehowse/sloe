# Apple Health card — design brief (D4, Option 2: both platforms)

> **Implementation status (2026-04-21):** shipped.
> - Migration: `supabase/migrations/20260429100000_health_snapshots.sql` (staged; `supabase db push --linked` pending).
> - Web component: `src/app/components/suppr/apple-health-card.tsx`, wired into `src/app/components/ProgressDashboard.tsx`.
> - Web adapter: `src/lib/health/healthSnapshots.ts` (`getLatestHealthSnapshot`, `formatHealthSnapshotSyncedAgo`, `isHealthSnapshotStale`).
> - Mobile component: `apps/mobile/components/AppleHealthCard.tsx`, wired into `apps/mobile/app/(tabs)/progress.tsx`.
> - Mobile write: `writeHealthSnapshot` in `apps/mobile/lib/healthSync.ts`, fired after `syncHealthDataThrottled` (15-min throttle; bypasses on explicit refresh).
> - Tests: `tests/unit/healthSnapshots.test.ts`, `tests/unit/healthSnapshotsMigration.test.ts` (RLS pin), `tests/unit/appleHealthCard.test.tsx`, `apps/mobile/tests/unit/writeHealthSnapshot.test.ts`.


## 1. Design intent

Apple Health card surfaces the four health metrics Suppr reads from HealthKit as a calm, read-only row list on Progress. On mobile it's native HealthKit. On web it's the same four numbers, read from the same account's last-synced mobile payload. Same visual language, same copy, same four rows — web is a viewer onto mobile-sourced data, not a second pipeline.

## 2. Structure

Per prototype `docs/ux/claude-design-bundles/prototype/project/screens-mobile.jsx:691-711`:

- Section heading row: small "Apple Health" h3.
- Card: 4 rows, each row = icon-box (16px lucide in a 28×28 tinted square) + label (13px secondary) on the left, tabular-nums 14px bold value on the right. 10px vertical padding per row, 1px hairline between rows (not above first).
- Footer line inside the card: 11px muted — "Based on your resting rate so far today. Activity bonus may be added if your total burn exceeds the TDEE estimate."

Rows (fixed order):
1. Steps — `Footprints` icon, muted-secondary tint
2. Active energy — `Flame` icon, warning colour
3. Resting burn — `HeartPulse` icon, macro-fat colour
4. Weight — `Scale` icon, macro-protein colour

### Web

Identical card, placed in the right-hand Progress column below the Trend summary. Max 480px wide. Title is "Apple Health" (not "Health" — the data source is the user-facing truth). When no mobile device has ever synced: card replaced by empty state (see §5).

### Mobile

Identical card, placed below the weekly protein bar chart per prototype. Full width minus 16px gutters.

## 3. Hierarchy

Label left, number right. Numbers win visual weight. The footer methodology line is always present and is the smallest text on the card.

## 4. Components

Reused:
- Card shell (`rounded-card border border-border bg-card`)
- lucide icons: `Footprints`, `Flame`, `HeartPulse`, `Scale` (mobile uses `lucide-react-native`, already on web)
- Existing 28×28 tinted icon-box pattern

New:
- `<AppleHealthCard />` — web and mobile components, same prop shape.
- Web-side data adapter `getLatestHealthSnapshot(userId)` that reads from a new Supabase table `health_snapshots` (see §10 open questions — this is the sync surface).

Retired: none.

## 5. States

- **Loading** — card frame with 4 skeleton rows (label bar + value bar), no footer methodology line.
- **Empty — mobile never synced** (web) — card replaced by a single-row empty state: "Sync from the Suppr app to see your health data here." with a subtle "Get the app" link. No fake rows.
- **Empty — HealthKit denied** (mobile) — card shows 4 rows with em-dash values and a footer replaced by "Allow Apple Health access in Settings to see this." with an inline "Open Settings" link.
- **Partial (e.g. steps available, weight not logged)** — missing rows show em-dash on the right + 11px muted hint under the label ("No weigh-in today"). Do not omit the row — the four-row structure is the pattern.
- **Error (fetch failed)** — card shows "Couldn't load Apple Health data." with retry link. No partial numbers.
- **Stale (web, last sync > 24h)** — rows render with last-synced values + 11px muted footer prefix: "Last synced {relative} ago · " before the methodology line.
- **Offline** — same as stale; card renders from cache; no retry button.

## 6. Nutrition treatment

- Active energy and Resting burn are kcal, tabular-nums, no decimals.
- Weight uses the user's unit (kg or lb) via existing formatter.
- No confidence chip: these are HealthKit-verified values. When we show them, they are "verified", not "estimated". If HealthKit returns 0 steps, we render 0, not em-dash — the device reported it.
- Edit affordance: none from this card. Weight edits happen via the existing weight logger.

## 7. Sync requirement (web-specific)

Web has no HealthKit. Web must read what mobile last wrote. New shape:

- Mobile writes: after each HealthKit fetch (existing context), write a row to a new table `health_snapshots`:
  - `user_id`, `captured_at`, `steps`, `active_energy_kcal`, `resting_burn_kcal`, `weight_kg`, `source` ('healthkit'), `device_id`.
- Web reads: `getLatestHealthSnapshot(userId)` returns the most recent row. Card uses `captured_at` for the stale/last-synced hint.
- Write cadence: on app foreground + at most once per 15 min; plus explicit user-triggered refresh.
- RLS: row accessible only to its owning `user_id`.

This is a backend surface. The design depends on it; it must ship first or in the same release.

## 8. Interactions

- **Row tap** — no action on v1. Do not make rows pressable.
- **Retry link (error state)** — re-runs fetch; shows loading row skeletons briefly.
- **"Open Settings" link** (mobile denied) — deep-links iOS Settings → Health → Suppr.
- **"Get the app" link** (web empty) — routes to App Store badge on /landing or /more.
- **Hover (web)** — no row hover. Only the card as a whole, no effect.

## 9. Cross-platform deviations

- **Data path** — mobile reads HealthKit directly; web reads `health_snapshots` table.
- **Empty state copy** — mobile talks about permission; web talks about the app not having synced.
- **Stale note** — web only; mobile's data is always real-time when the card renders.
- **Icon library** — `lucide-react-native` on mobile, `lucide-react` on web. Same glyph names.

## 10. Acceptance criteria

1. Card renders identically on web and mobile (row order, icons, copy, spacing).
2. Web card reads from `health_snapshots` table only; no direct HealthKit call on web.
3. Mobile writes a `health_snapshots` row on every successful HealthKit fetch.
4. All 7 states exist, copy-complete, and pass screen reader traversal.
5. Card does not fabricate data: partial shows em-dash, not zero, except for steps/burn where HealthKit returned an actual zero.
6. Last-synced relative time updates on web without a full reload (React state).
7. RLS test: another user cannot read this user's snapshots.
8. Zero new colour tokens; all icon tints use existing `MacroColors` / semantic tokens.

## 11. Open questions

- **Sync table vs widening `profiles`**: one-row-per-user (simpler, overwrite-in-place) vs append-only `health_snapshots` (history, better for debugging). Route to `nutrition-engine` + DB review. Recommendation: append-only with a view for latest.
- **Web "Get the app" link** — gated on App Store presence; pre-launch, link to /landing.
- **Active bonus copy** — current methodology line references "activity bonus if total burn exceeds TDEE estimate". Confirm that still matches the adaptive-TDEE logic post-Ship-M1. Route to `nutrition-engine`.
- **Analytics** — fire `apple_health_card_shown` on both platforms with a `staleSeconds` field on web.
