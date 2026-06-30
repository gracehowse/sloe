# Data export ("Export everything")

Status: shipped 2026-04-30
Owner: product-engineer
Surfaces: web Settings → Privacy & Security; mobile Settings → "Data" section

## Why this exists

The 2026-04-30 user-sentiment audit found a universal pattern across
competitor reviews — "lock-in anxiety". Common complaints:

- Paprika: "recipes disappeared after upgrade"
- MyFitnessPal: "history gone after update"
- Recime / Honeydew: "data vanished post-payment"

The universal counter is **explicit, visible, exportable user data**.

GDPR Article 20 (right to data portability) is the legal floor;
Suppr exceeds it by making the export one tap deep, zero-friction,
and authenticated-only — no email round-trip, no support ticket,
no waiting period.

The user-facing affordance is "Export everything" with the trust
line "Yours forever. Take your data anywhere."

## What gets exported

A single JSON blob with the following keys:

| Key                   | Source table             | Window    |
|-----------------------|--------------------------|-----------|
| `profile`             | `profiles`               | full row  |
| `recipes`             | `recipes` (own)          | all       |
| `recipeIngredients`   | `recipe_ingredients`     | for own recipes |
| `saves`               | `saves`                  | all       |
| `mealLog`             | `nutrition_entries`      | last 365 days |
| `weightHistory`       | `health_snapshots`       | last 365 days |
| `customFoods`         | `user_custom_foods`      | all       |
| `planDays`            | `meal_plan_days`         | all       |
| `planMeals`           | `meal_plan_meals`        | for own plan days |
| `shopping`            | `shopping_items`         | active only |
| `savedMeals`          | `user_saved_meals`       | all       |
| `savedMealItems`      | `user_saved_meal_items`  | for own saved meals |
| `recipeNotes`         | `user_recipe_notes`      | all       |
| `householdMemberships`| `household_members` (own `user_id`) | all       |

Plus the meta fields:

- `schemaVersion` — bumped on every breaking shape change
- `exportedAt` — ISO timestamp of the read
- `userId` — Supabase auth UID
- `windowDays` — currently `365`

Tables that aren't yet present in a given Supabase environment
(e.g. `user_recipe_notes` on older deployments) degrade to `[]`
rather than 500-ing the request — the export should never silently
truncate.

## File format

JSON. UTF-8. Pretty-printed with 2-space indent. Filename:
`suppr-export-{userId}-{YYYY-MM-DD}.json` on web and
`suppr-export-{userId.slice(0, 8)}-{YYYY-MM-DD}.json` on mobile
(the mobile filename is shortened to keep Files-app rows readable).

## Endpoint

`GET /api/export/me`

- Auth: `Authorization: Bearer <jwt>` (mobile) or `sb-*` cookies (web)
- Response: `200` with `Content-Type: application/json` and
  `Content-Disposition: attachment; filename="..."`
- Cache: `Cache-Control: no-store` (the payload is PII)
- Errors:
  - `401 unauthorized` — missing / invalid auth
  - `429 rate_limited` — see below; sets `Retry-After`
  - `503 service_unavailable` — service-role key not configured
  - `500 export_failed` — any non-ignorable Supabase error during read

## Schema version

Currently `2`. Increment when the export shape breaks consumer
assumptions:

- key rename
- key removal
- semantics change

**v2 (2026-06-13, ENG-850):** removed the `plans` key. Its source
table `meal_plans` was dropped 2026-04-21 (normalised into
`meal_plan_days` + `meal_plan_meals`), so `plans` had been silently
exporting `[]` ever since. Plan data is fully represented by `planDays`
+ `planMeals`.

Additive new keys are NOT a breaking change — existing consumers
ignore unknown fields.

**`householdMemberships` added (2026-06-30, ENG-1271):** additive key —
the user's own `household_members` rows, filtered on `user_id` (never
`household_id`, which would leak co-members' rows). This closed a gap with
the delete-cascade ledger (`app/api/account/delete/route.ts`), which already
listed `household_members.user_id` as cascade-deleted on account deletion —
the export now portably returns what the delete flow removes. No
`schemaVersion` bump (additive).

## Rate limit

1 export / 60s per user. The bucket key composes as
`api:export:me:user:{userId}:{ip}` so:

- A user double-tapping the row gets a clean `429` (with
  `Retry-After: <seconds>`) on the second tap — they don't
  accidentally trigger two downloads.
- An IP-rotating attacker can't drain the bucket on behalf of
  another user (per-user scoping closes the
  cross-user starvation hole the original IP-only key had).
- A shared NAT (corporate Wi-Fi) doesn't starve legitimate users.

The window is intentionally short — this is a moat-builder, not a
high-frequency endpoint, but the UI shouldn't feel locked-out.

## Re-import to other tools

Suppr does not yet offer "import from Suppr export" — the JSON is
intended for:

- **User backup**: drop in iCloud Drive / Dropbox; sleep easier.
- **Migration to spreadsheets**: jq one-liners turn `mealLog` into
  CSV; for example
  `jq '.mealLog | map([.date_key, .name, .calories]) | .[] | @csv' export.json`.
- **Migration to other apps**: most competitors accept JSON imports
  with a custom mapping. We don't ship per-competitor adapters; the
  export is documented enough for the user (or their developer) to
  build one.

For spreadsheet-friendly meal-log-only exports, the existing CSV
button at Settings → "Export nutrition log (CSV)" is unchanged.

## Analytics

`data_export_initiated` fires server-side (via
`src/lib/analytics/serverTrack.ts`) after the payload is built so
`sizeBytes` is real, not estimated. Properties:

```
{
  sizeBytes: number,
  recipeCount: number,
  mealLogCount: number,
  weightCount: number,
  customFoodCount: number,
  planCount: number,
  shoppingCount: number,
  schemaVersion: number,
  platform: "web" | "ios"
}
```

This is the moat-tracking surface: we want to know how often this
is used because that's how we tell whether the lock-in
counter-message is reaching users. Funnel pair: settings page view →
`data_export_initiated`.

## Estimated typical export size

Rough sizing for a moderately active user:

- Profile: ~2 KB
- 365 days of meal-log entries (avg 4 / day): ~250 KB
- 365 days of weight + activity snapshots: ~60 KB
- Recipes + ingredients: ~30 KB
- Plans + days + meals: ~30 KB
- Saves, custom foods, shopping, saved meals: ~10 KB

**Typical total: 300-500 KB. p95 under 1 MB.** Power users with
multi-year-equivalent activity inside the 365-day window or large
custom-food libraries can push past 1 MB. We have not yet seen a
real export above 5 MB, but if that becomes load-bearing the v2
path is paginated chunks (e.g. month-windowed `mealLog` ZIPs) — we
will revisit when sustained `sizeBytes` p99 trends past 5 MB in
PostHog.

## Cross-platform parity

| Platform | Surface                                | Auth path        | File handling                         |
|----------|----------------------------------------|------------------|---------------------------------------|
| Web      | Settings → Privacy → Export everything | sb-* cookies     | Blob → `<a download>` triggers save   |
| Mobile   | Settings → Data → Export everything    | Bearer token     | `expo-file-system` writeAsStringAsync to cache → `Share.share({ url })` opens iOS activity sheet (Save to Files / AirDrop / Mail / Messages) |

Both platforms call the **same endpoint** — bytes are identical.
Differences are surface-only: web download dialog vs iOS share sheet.

The mobile flow is iOS-only by spec (the only mobile platform on
TestFlight today). When Android joins the platform list, swap
`Share.share` for `expo-sharing`'s `Sharing.shareAsync` to abstract
the platform.

## Delete-flow "Download a copy first" (ENG-1262)

The DeleteAccount 3-step sheet (`DeleteAccountSheet`, ENG-1260) shows a
**"Download a copy first"** button at step 2, immediately before permanent
account deletion. As of ENG-1262 that button runs the **same complete
`/api/export/me` archive** described above — on both platforms:

| Platform | Export-first path |
|----------|-------------------|
| Web      | `downloadSupprExport(supabase)` (`src/lib/client/exportEverythingWeb.ts`) → blob download |
| Mobile   | `exportEverythingToFile(userId)` (`apps/mobile/lib/exportEverything.ts`) → cache write → iOS share sheet |

Before ENG-1262 the export-first action ran the **meal-log-only CSV**
(`runCsvExport` / `runExportCsv`) — handing the user a partial archive right
before deleting the authoritative server copy (a GDPR Art. 20 portability gap).
The button now disables + shows a spinner while the heavy, rate-limited export
is in flight (`exportingFirst`), so it can't be double-submitted.

The CSV path is unchanged and still available as the curated meal-log subset at
Settings → "Export nutrition log (CSV)".

The web "Export everything" Settings row and the delete-flow export-first action
both call the shared `downloadSupprExport` helper, so there is exactly one
complete-archive code path on web (no inlined, drifting copies).

## Deletion removal ledger + de-attribution disclosure (ENG-1263)

The DeleteAccount sheet's step 2 shows a **removal ledger** — a red-✕ list of
what the destructive flow erases — so the user gives informed consent before an
irreversible action. The ledger counts come from
`src/lib/settings/fetchDeleteAccountLedger.ts`; the row formatting + the
disclosure footnote live in the shared SSOT
`src/lib/settings/deleteAccountFlow.ts`.

**The ledger lists only what is HARD-DELETED.** The recipes row counts:

- saved recipes (`saves` — deleted by the route), **plus**
- unpublished authored drafts (`recipes WHERE author_id = user AND
  published = false` — deleted by step 3 of the route).

It does **not** count **published authored recipes**. Those survive
de-attributed: the delete route (step 4) sets `author_id = null` and the recipe
stays public. This is the correct, legally-sufficient GDPR **Art. 17** erasure
posture (de-identification — confirmed by legal-reviewer 2026-06-29; the
hard-delete alternative was rejected). The recipes row label reads
**"N saved recipes & drafts"** (not "saved & created") so it never implies a
published recipe was destroyed.

To keep that honest, step 2 renders a **de-attribution footnote** beneath the
ledger on both platforms (`DELETE_ACCOUNT_DEATTRIBUTION_NOTE`, rendered with
`testID="delete-account-deattribution-note"`):

> Recipes you've published stay public, but we remove your name from them.
> Anyone who saved or cooked them keeps their copy. Everything else here is
> deleted for good.

The "Delete forever" button label is unchanged — it is accurate for the
hard-deleted majority, and the footnote carves out the published exception.

**Open question for formal counsel (data-integrity + legal):** the privacy
policy should not treat de-attribution as *final* erasure until it is confirmed
that the de-attribution is effectively irreversible in the DB and in backups —
i.e. no shadow author link / restore re-link path that could re-associate a
"deleted" user with their published recipes.

## Files

- Server endpoint: `app/api/export/me/route.ts`
- Web client helper: `src/lib/client/exportEverythingWeb.ts`
  (`downloadSupprExport` — shared by the Settings row + delete-flow export-first)
- Mobile helper: `apps/mobile/lib/exportEverything.ts`
- Mobile UI: `apps/mobile/components/settings/SettingsBundleContent.tsx`
  (search `settings-bundle-export-everything-row`)
- Web UI: `src/app/components/Settings.tsx` (search
  `settings-export-everything-button`)
- Delete-flow export-first: `src/app/components/settings/DeleteAccountSheet.tsx`
  + `apps/mobile/components/settings/DeleteAccountSheet.tsx` (search
  `delete-account-export-first`)
- Tests:
  - `tests/integration/exportMeRoute.test.ts` (incl. per-user isolation,
    ENG-1262)
  - `tests/unit/settingsExportEverythingWeb.test.ts`
  - `tests/unit/exportEverythingWeb.test.ts` (web helper, ENG-1262)
  - `tests/unit/deleteAccountExportFirstWiring.test.ts` (web wiring, ENG-1262)
  - `tests/unit/fetchDeleteAccountLedger.test.ts` (ledger counts; published vs
    unpublished split, ENG-1263)
  - `tests/unit/deleteAccountFlow.test.ts` (ledger labels + de-attribution
    footnote SSOT + web/mobile parity pin, ENG-1263)
  - `tests/unit/deleteAccountSheetDeattribution.test.tsx` (web sheet renders the
    footnote on step 2, ENG-1263)
  - `apps/mobile/tests/unit/exportEverything.test.ts`
  - `apps/mobile/tests/unit/settingsExportEverythingRow.test.ts`
  - `apps/mobile/tests/unit/deleteAccountExportFirstWiring.test.ts`
    (mobile wiring, ENG-1262)

## Related

- Account deletion (the destructive twin): `app/api/account/delete/route.ts`
  (step 3 hard-deletes unpublished drafts; step 4 de-attributes published
  recipes — see the removal-ledger section above)
- CSV meal-log export (curated subset): `src/lib/export/nutritionLogToCsv.ts`
