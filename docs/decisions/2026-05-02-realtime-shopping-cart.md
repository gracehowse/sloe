# 2026-05-02 — Realtime shared shopping cart (Honeydew "two phones at Tesco" parity)

**Status:** Resolved
**Area:** Household / shopping list / Supabase Realtime
**Authority:** 2026-04-30 competitor audit wave 2 (gap #8: Honeydew's
"two phones at Tesco" hook).

## Decision

Wire a Supabase Realtime channel to `shopping_items`, scoped to the
active household, on both web and mobile. INSERT / UPDATE / DELETE
events from any household member appear within ~1s on every other
member's device, accompanied by an attributed toast ("Sam added
'milk' to the list", "Alex checked off 'eggs'").

## Why

Honeydew's signature moment is two phones in different aisles of the
same Tesco, watching items strike off in real time. Suppr already
had:

- the shared list schema (`shopping_items.household_id`,
  `checked_by`, `checked_at`) via
  `supabase/migrations/20260504100100_household_shopping.sql`
- household membership resolution (`getMyHousehold`)
- the existing per-user shopping list reads / writes

What it didn't have was the live channel. Without it, two members
saw stale lists until one manually refreshed.

## What we shipped

1. **`src/lib/household/shoppingRealtime.ts`** — pure helpers:
   - `subscribeShoppingItemsChannel({ supabase, scope, onChange })` —
     wires a `postgres_changes` listener with a household-scoped
     filter (or per-user for solo) and returns the unsubscribe.
   - Self-event filtering: own changes don't toast back. The check-
     toggle case picks up the actor from `checked_by` (set by the
     toggling client) rather than the row's `user_id` (the original
     creator), so Sam ticking Alex's "eggs" attributes correctly.
   - `formatShoppingChangeToast({ event, members, ownUserId })` —
     produces the same copy on both platforms ("Sam added", "Alex
     unchecked", "Member ab12 removed" when names are missing).

2. **Web — `src/context/appData/useShoppingListState.ts`** — adds
   the household resolution effect + the realtime subscription
   effect. Inserts append to local state and surface a sonner toast;
   deletes remove the row. Self-events are filtered upstream.

3. **Mobile — `apps/mobile/app/shopping.tsx`** — same shape. Toast
   surface uses `ToastAndroid.SHORT` on Android and `Alert.alert` on
   iOS (no native toast primitive; matches the existing realtime
   notification code path in `apps/mobile/lib/notifications.ts`).

## Cost

Supabase Realtime is **free** at low volume — included in the Free
tier (200 concurrent connections, 2M messages/month). This use case
puts ≤1 connection per active session and a low-thousands events
ceiling per household-month. We are far inside the free envelope.
The same channel pipe is already used for in-app notifications, so
this is not a new infra surface.

## RLS / security

The realtime payload delivery re-runs RLS on every change event —
the same `household_shopping_select` policy that gates the read.
A non-member never receives another household's events, even if
they manage to subscribe to the channel name (which they couldn't
construct without knowing the household uuid).

## Schema follow-up

The migration `supabase/migrations/20260504100100_household_shopping.sql`
adds `household_id`, `checked_by`, `checked_at` and adds
`shopping_items` to the `supabase_realtime` publication. The
realtime channel works without the migration applied — events just
won't fire (and `checked_by` will be null in the toast actor
resolution, falling through to the row's `user_id`).

Apply path (per CLAUDE.md): stage and run
`supabase db push --linked`. Never apply via MCP `apply_migration`
(rewrites `schema_migrations.version` to NOW() and corrupts ordering).

## Out of scope

- Cursor / "Sam is on row 12" presence. Honeydew has it; we don't
  need it for the parity moment. Logged as a future explore.
- Optimistic concurrency / conflict resolution beyond last-writer-
  wins. Two members editing the same row's `name` simultaneously
  is not a real-world hot path.
- Notification permissions. The toast is in-app only — no system
  push for shopping changes (would be too noisy).

## Test surface

- `tests/unit/shoppingRealtime.test.ts` — 20 tests on the helper
  (channel name, filter, subscribe/unsubscribe, INSERT / UPDATE /
  DELETE fan-out, self-filter, toast copy, missing-name fallback).
- `tests/unit/shoppingRealtimeWiring.test.tsx` — 5 tests on the
  web hook (filter is `household_id=eq.hh-1`, INSERT appends +
  toasts, DELETE removes + toasts, self-event ignored, unmount
  tears the channel down).
- `tests/unit/shoppingScope.test.ts` — 10 tests pinning the
  scope-helper contract that the realtime subscribe + RLS shape
  depend on.

Total 35 new tests.
