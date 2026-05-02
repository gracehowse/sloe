# 2026-05-02 — Real-time meal-plan editing (Honeydew couples-loop parity)

**Status:** Resolved
**Area:** Household / Plan / Realtime
**Authority:** customer-lens caveat raised against PR #39

## Problem

PR #39 ("household: real-time shared shopping cart") closed the
"two phones at Tesco" gap versus Honeydew. Customer-lens flagged
that this was only **half** of Honeydew's couples-loop:

> Honeydew's couples loop is plan-then-shop; we have shop-realtime,
> not plan-realtime.

The shopping list is the **last mile** of the loop. The first mile —
two members editing next week's meal plan together, with each other's
swaps appearing live — is where Honeydew's marketing screenshots live
and where the "we plan together" emotional cue actually lands. Without
plan-realtime, the experience reads as "we shop together, but we plan
alone and then sync".

## Decision

Extend the shop-realtime helper pattern to `meal_plan_meals`. Same
shape, same RLS contract, same Supabase Realtime publication, same
cross-platform toast surface. Web (`AppDataContext.tsx`) and mobile
(`apps/mobile/app/(tabs)/planner.tsx`) both subscribe on mount, scope
the channel to the active household, and surface a toast on every
INSERT / UPDATE / DELETE from another household member ("Sam added
'Spaghetti Bolognese' to Tuesday lunch").

The same self-event filtering applies: the user's own writes are
swallowed by the helper before reaching the listener.

## Out-of-scope (intentional)

- **Cursor presence** — no "Sam is editing Tuesday lunch" pre-write
  cue. Realtime CRDT-style co-editing is a separate fixture; today's
  scope is post-write notifications.
- **Conflict resolution** — last writer wins. Two members swapping
  the same slot at the same time will land in last-writer-wins with
  both changes toasted. Acceptable for the scale we operate at
  today (N=1 tester), and matches the shopping-cart precedent.
- **Solo-device sync** — solo users (no household) get a no-op
  unsubscribe. They have one device by definition. The
  helper still composes cleanly if we later add multi-device solo
  sync (just call `subscribePlanChannel` with `householdId: null`
  and a per-user filter).
- **Stamping `household_id` on writes** — the migration adds the
  columns + RLS + publication. **The `save_meal_plan` RPC does NOT
  yet stamp `household_id` on inserted rows.** That's a separate
  follow-up: solo writes continue to land with `household_id = null`
  (matching the legacy "Own plan meals" behaviour), and household
  realtime broadcasts will fire only for rows whose writer-side
  code has been updated. Tracked as a follow-up below.

## Schema dependency

`supabase/migrations/20260504100000_meal_plan_household_id.sql`
(STAGED, NOT applied):

- `meal_plan_days.household_id uuid null` (FK → `households.id`)
- `meal_plan_meals.household_id uuid null` (FK → `households.id`,
  denormalised so Realtime postgres_changes can filter on it directly
  — Realtime cannot do JOIN sub-queries)
- Replace legacy "Own plan days" / "Own plan meals" with explicit
  per-action policies:
  - `household_id IS NULL` branch — falls back to legacy user-id
    check (no behaviour change for solo users)
  - `household_id IS NOT NULL` branch — every household member can
    SELECT / INSERT / UPDATE / DELETE; INSERT/UPDATE `with check`
    forces the caller to belong to whichever household_id they're
    stamping.
- `alter publication supabase_realtime add table public.meal_plan_meals;`

Apply path (per CLAUDE.md):

```
supabase db push --linked
```

**Never** via MCP `apply_migration` — it rewrites
`schema_migrations.version` to wall-clock NOW() and corrupts ordering.

## RLS contract

Realtime payload delivery is gated by the same SELECT policy that
gates regular reads. A non-member never receives another household's
plan change events — there is no client-side trust assumption beyond
"the session token represents the right user".

The recursion-break helper `public.auth_household_ids()` (defined in
`20260423110000_household_rls_recursion_fix.sql`) is reused so the
new policies don't form a cycle on `household_members`.

## Toast copy

- INSERT: `Sam added "Spaghetti Bolognese" to Tuesday lunch`
- UPDATE (recipe swap): `Alex swapped Wednesday breakfast to "Pancakes"`
- UPDATE (no recipe change — e.g. portion/macro tweak):
  `Alex updated Wednesday breakfast`
- DELETE: `Sam removed "Spaghetti Bolognese" from Tuesday lunch`
- Fallback when display name is missing: `Member ab12 added …`
- Fallback when day/slot are both missing: `Sam added "X" to a meal`

Identical copy on web + mobile via the shared
`formatPlanChangeToast` helper. Web surfaces via sonner; mobile
surfaces via `Platform.OS === "android" ? ToastAndroid : Alert.alert`
to match the existing shopping-cart pattern (no toast primitive on
iOS without a 3rd-party lib).

## Self-event attribution

The helper resolves the actor id from the parent day's `user_id`
via the host-supplied `dayLookup` map. Today's planner only lets a
user edit their own days, so this is correct. A future "shared
day" mode (where members can edit each other's days) needs a
`last_edited_by` column on `meal_plan_meals`. The helper's
`actorIdForRow` is a single-line change to swap.

## Cost

Supabase Realtime is on the free tier at our scale (N=1 tester →
N≈10 expected next month). Same pipe as in-app notifications
(PR4) and shop-realtime (PR #39). No new vendor.

## Cross-platform parity

| Surface           | Web                               | Mobile                                            |
| ----------------- | --------------------------------- | ------------------------------------------------- |
| Helper            | `src/lib/household/planRealtime.ts` (shared) | same |
| Subscription host | `src/context/AppDataContext.tsx`  | `apps/mobile/app/(tabs)/planner.tsx`              |
| Household lookup  | `getMyHousehold` from `householdClient` | same                                       |
| Toast surface     | `sonner`                          | `ToastAndroid` (Android) / `Alert.alert` (iOS)    |
| Refetch on event  | `reloadMealPlanFromDb` (in AppDataContext) | `reloadPlanFromDb` (in planner.tsx)         |

No intentional divergence.

## Tests

- `tests/unit/planRealtime.test.ts` — 24 tests covering the pure
  helper (channel name, filter, INSERT/UPDATE/DELETE fan-out,
  self-filter, toast copy spec, missing-name fallback, no-op
  for solo).
- `tests/unit/planRealtimeWiring.test.tsx` — 7 tests covering the
  React-side wiring contract (subscribe on mount, refetch on
  event, toast on event, self-filter, solo no-op, unmount tears
  down).

## Follow-ups

1. **Update `save_meal_plan` RPC to stamp `household_id`** when the
   caller is in a household. Without this, household members'
   writes continue to land with `household_id IS NULL` and the
   realtime broadcast never fires. Owner: `data-integrity` →
   `executor`.
2. **`last_edited_by` column on `meal_plan_meals`** — required if/when
   we let members edit each other's days. Owner: `data-integrity`.
3. **Cursor presence** — "Sam is editing Tuesday lunch" pre-write
   cue. Owner: `ui-product-designer` → spec, then `executor`.

## Authority

- Customer-lens caveat raised against PR #39 (shop-realtime).
- 2026-04-30 competitor audit wave 2 (gap #8 closed for shop, #8b
  open for plan — closed by this PR).

## Out-of-band

Notion mirror (Decisions log + Tasks):

- Decisions log: add row "2026-05-02 plan-realtime-sync" linking
  to this file.
- Roadmap: any matching "household couples-loop" row → mark
  Shipped (loop is now plan-then-shop end-to-end, modulo the
  `save_meal_plan` follow-up).
- Tasks: open follow-up "save_meal_plan: stamp household_id" → Open.
