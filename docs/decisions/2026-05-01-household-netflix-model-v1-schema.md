# Household Netflix-model v1 — schema + privacy boundary

**Date:** 2026-05-01
**Status:** Resolved (schema landed; UI sweep follows in a separate change)
**Supersedes:** `docs/planning/2026-04-22-household-netflix-model-spec.md` on schema items only; UI work still pending.

## What shipped

Three migrations laying the data foundation for the Netflix-model redesign. UI, invite/join flow, and web parity are deliberately separate commits so each can be reviewed in isolation.

1. `20260501100000_household_share_preset.sql` — adds `share_preset text` to `household_members` with a five-value check constraint (`all`, `dinners`, `dinners_weekends`, `lunch_dinner`, `custom`), defaulting to `dinners`. Backfills any household currently on `share_lunch = true` so existing members default to `lunch_dinner` rather than silently narrowing.
2. `20260501100010_households_disbanded_at.sql` — adds `disbanded_at timestamptz` for soft-delete. Last-member-leaves triggers a 30-day retention window before hard-delete; prevents orphaning of `household_meals` referenced by other users' history.
3. `20260501100020_household_meals_cook_display_name.sql` — snapshots the cook's display name onto each meal row so leavers' historical attribution stays legible. Backfills from current membership rows.

## Privacy boundary (the load-bearing rule)

**Households see what's on the table, not what's on the scale.**

- No household migration writes RLS policies for `profiles`, `weight_entries`, `nutrition_entries`, `health_snapshots`, `daily_targets`, `user_activity`, `adaptive_tdee`, `body_measurements`, or `user_foods`.
- No household RLS predicate joins through those tables.
- `household_meals` carries per-serving nutrition (recipe metadata) only — no per-user macro targets, weight, or streak state.
- `household_members` stores membership + role + display name + sharing preset. No target calories, weight, or goal columns.

These invariants are pinned at migration level by `tests/unit/householdPrivacyRls.test.ts`. A future change that adds a household policy to `profiles`, or a predicate that reads from `weight_entries`, will fail CI.

## Why not an ownership-transfer audit row in v1

Spec §5 listed `household_ownership_transfers` as one of the four missing pieces. Deferred to v2: with Grace as the only tester today, the event volume is zero, and the read path (Settings → Household) doesn't need a history. Re-open once member counts grow past 1 household.

## Why not a new invite-codes table in v1

Spec §5 proposed a dedicated `household_invite_codes` table keyed by short code. The existing model (`households.invite_code` + `invite_code_expires_at`) already gives us single-code-per-household with 7-day expiry and owner-triggered rotation on churn. A table-per-code would enable multiple concurrent codes (e.g. revocable single-use links), which is not a v1 requirement. Kept as-is; revisit if invite abuse shows up or multi-code semantics become product-relevant.

## Apply path

Standard: `supabase db push --linked` against the linked project. Never via MCP `apply_migration` (would rewrite `schema_migrations.version` to `now()` and break the monotonic file ordering).

## Next steps (not in this change)

- Preset-picker UI on `household-settings.tsx` + `HouseholdSettingsPage.tsx` (web) — writes to `share_preset`, custom grid becomes the `custom` preset's payload.
- Read-path switch: `getMyHousehold` reads `share_preset` and returns the correct slot set per member instead of honouring the owner-level `share_lunch` flag.
- Soft-delete wiring: last-member-leaves sets `disbanded_at`; client filters disbanded households from all reads.
- Cook display-name snapshot populated on every new `household_meals` insert (client-side change in `householdClient.ts` + mobile equivalent).
