/**
 * Real-time shared meal plan editing — Honeydew couples-loop parity
 * (2026-05-02).
 *
 * Customer-lens caveat that drove this PR: "Honeydew's couples loop
 * is plan-then-shop; we have shop-realtime, not plan-realtime." PR #39
 * shipped real-time `shopping_items` sync via
 * `src/lib/household/shoppingRealtime.ts`. This module is the parallel
 * helper for `meal_plan_meals` so the same two-phones-edit-the-week
 * UX lands on the planner surface.
 *
 * Pure helper module — no React, no DOM, no React Native. Web
 * (`AppDataContext.tsx`) and mobile (`apps/mobile/app/(tabs)/planner.tsx`)
 * both consume `subscribePlanChannel` to wire a Supabase Realtime
 * channel scoped to the active household, then funnel every INSERT /
 * UPDATE / DELETE event through the shared `formatPlanChangeToast`
 * helper so the user-visible toast copy is identical across
 * platforms.
 *
 * Schema dependency:
 *   `supabase/migrations/20260504100000_meal_plan_household_id.sql`
 *   adds `meal_plan_days.household_id` and `meal_plan_meals.household_id`,
 *   and adds `meal_plan_meals` to the `supabase_realtime` publication.
 *   Without that migration the channel will simply receive no events
 *   (Supabase silently drops payloads for tables not in the
 *   publication). Apply path: stage the SQL and run
 *   `supabase db push --linked` (per CLAUDE.md, never via MCP).
 *
 * RLS contract:
 *   The same RLS that gates SELECT also gates Realtime payload
 *   delivery. A non-member never receives another household's plan
 *   change events — there is no client-side trust assumption beyond
 *   "the session token represents the right user". See
 *   `household_plan_meals_select` policy in the migration above.
 *
 * Self-event filtering:
 *   Realtime delivers the user's OWN edits back to them. We don't
 *   want to toast "You added Spaghetti Bolognese" — that would feel
 *   like a stutter. `subscribePlanChannel` filters out events whose
 *   actor user id matches the subscriber's own user id BEFORE
 *   invoking the listener. The actor is read from the parent day's
 *   `user_id` (resolved by the host via `actorIdForRow`) because
 *   `meal_plan_meals` has no per-row writer column today. This is a
 *   pragmatic fallback — a household member who edits another
 *   member's day will currently be attributed to the day's owner;
 *   acceptable because today's UI only lets a user edit their own
 *   days. A `last_edited_by` column is a follow-up if/when we add
 *   cross-day edits.
 */

/**
 * Minimal duck-type for a Supabase client — accepts both the web
 * `browserClient` and the mobile `supabase` instance without
 * pulling in `@supabase/supabase-js` types here. Keeps this helper
 * platform-agnostic and easy to mock in tests.
 */
type SupabaseLike = {
  channel(name: string): any;
  removeChannel(channel: any): unknown;
};

/**
 * Realtime change-event payload shape we care about. Subset of
 * `RealtimePostgresChangesPayload` — we read only what the toast
 * formatter and the local-state reconciler need.
 *
 * `meal_label` is derived at format time from the row's `name`
 * column (the planner stores slot labels there, e.g. "Lunch"). We
 * keep the column name aligned with the relational schema rather
 * than aliasing to "meal_label" to avoid a translation layer.
 */
export type MealPlanItemRow = {
  id: string;
  plan_day_id: string;
  household_id: string | null;
  /** Slot label — "Breakfast" / "Lunch" / "Dinner" / "Snacks". */
  name: string;
  recipe_title: string;
  recipe_id?: string | null;
  slot_index: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion_multiplier?: number | null;
  is_placeholder?: boolean | null;
};

/**
 * Resolved day metadata for toast copy. The host populates this
 * map (plan_day_id → { day, dayLabel }) before subscribing so the
 * toast can read "Tuesday lunch" without a second DB round-trip
 * inside the realtime callback. `day` is 1..7 (Sunday..Saturday)
 * matching the existing `meal_plan_days.day` column.
 */
export type PlanDayLookup = {
  /** 1..7 — meal_plan_days.day. */
  day: number;
  /** Pre-formatted weekday label, e.g. "Tuesday". */
  dayLabel: string;
  /** Optional auth user id of the day's owner — used for self-filter
   *  and toast attribution when the row carries no actor column. */
  ownerUserId?: string | null;
};

export type PlanChangeEvent =
  | { kind: "insert"; row: MealPlanItemRow; actorId: string | null }
  | {
      kind: "update";
      row: MealPlanItemRow;
      previous: MealPlanItemRow | null;
      actorId: string | null;
    }
  | { kind: "delete"; row: MealPlanItemRow; actorId: string | null };

export type PlanChangeListener = (event: PlanChangeEvent) => void;

export type PlanRealtimeScope =
  | { kind: "household"; householdId: string; userId: string }
  | { kind: "solo"; userId: string };

/**
 * Build the channel name for a given scope. Per-household for
 * household scope; per-user for solo (so two solo users on a shared
 * device don't cross-talk). Channel names land in Supabase's
 * broadcast index — keep them stable + unique per scope.
 */
export function planRealtimeChannelName(scope: PlanRealtimeScope): string {
  if (scope.kind === "household") return `plan:hh:${scope.householdId}`;
  return `plan:user:${scope.userId}`;
}

/**
 * Resolve the actor id for a given row + previous-row pair. Today
 * we read the parent day's owner id from `dayLookup`. Pulled into a
 * helper so a future `last_edited_by` column can land in one place.
 */
function actorIdForRow(
  row: MealPlanItemRow | null,
  dayLookup: Map<string, PlanDayLookup>,
): string | null {
  if (!row) return null;
  const day = dayLookup.get(row.plan_day_id);
  return day?.ownerUserId ?? null;
}

/**
 * Subscribe to `meal_plan_meals` change events for the given scope.
 * Returns an unsubscribe function — the caller MUST invoke it on
 * teardown to avoid leaking a channel + websocket frame on every
 * navigation.
 *
 * The listener is invoked AFTER self-events are filtered out (by
 * default — pass `{ includeSelf: true }` for tests).
 *
 * The household filter is `household_id=eq.<id>`; for solo users we
 * skip the channel entirely (a per-user filter would still work but
 * solo users have a single device, so the network round-trip is
 * pure overhead — return a no-op unsubscribe instead).
 */
export function subscribePlanChannel(opts: {
  supabase: SupabaseLike;
  householdId: string | null;
  currentUserId: string;
  /** plan_day_id → { day, dayLabel, ownerUserId } */
  dayLookup: Map<string, PlanDayLookup>;
  /** Emit own changes too. Default false. Tests pass `true`. */
  includeSelf?: boolean;
  onChange: PlanChangeListener;
}): () => void {
  const {
    supabase,
    householdId,
    currentUserId,
    dayLookup,
    includeSelf = false,
    onChange,
  } = opts;

  // Solo users skip the subscription — there's no second device to
  // sync with. Returning a no-op keeps the call site simple
  // (always invoke unsub on cleanup).
  if (!householdId) {
    return () => {};
  }

  const scope: PlanRealtimeScope = {
    kind: "household",
    householdId,
    userId: currentUserId,
  };
  const channelName = planRealtimeChannelName(scope);
  const filter = `household_id=eq.${householdId}`;

  const handle = (payload: any) => {
    const eventType = payload?.eventType ?? payload?.event ?? null;
    if (!eventType) return;
    const row: MealPlanItemRow | null = payload?.new ?? null;
    const old: MealPlanItemRow | null = payload?.old ?? null;

    if (eventType === "INSERT" && row) {
      const actor = actorIdForRow(row, dayLookup);
      if (!includeSelf && actor && actor === currentUserId) return;
      onChange({ kind: "insert", row, actorId: actor });
      return;
    }
    if (eventType === "UPDATE" && row) {
      const actor = actorIdForRow(row, dayLookup);
      if (!includeSelf && actor && actor === currentUserId) return;
      onChange({ kind: "update", row, previous: old, actorId: actor });
      return;
    }
    if (eventType === "DELETE") {
      const target = old ?? row;
      if (!target) return;
      const actor = actorIdForRow(target, dayLookup);
      if (!includeSelf && actor && actor === currentUserId) return;
      onChange({ kind: "delete", row: target, actorId: actor });
      return;
    }
  };

  const channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meal_plan_meals",
        filter,
      },
      handle,
    )
    .subscribe();

  return () => {
    unsubscribePlanChannel(supabase, channel);
  };
}

/**
 * Tear down a previously-subscribed plan channel. Exposed as a
 * named helper so call sites can pass the channel reference around
 * (e.g. stash on a ref) and invoke teardown explicitly. Wraps
 * `removeChannel` in a try/catch because that call can throw on
 * already-closed sockets in tests + on app suspend.
 */
export function unsubscribePlanChannel(supabase: SupabaseLike, channel: any): void {
  try {
    void supabase.removeChannel(channel);
  } catch {
    /* removeChannel may throw on already-closed sockets — swallow. */
  }
}

/**
 * Resolve a member's display name from the household-members map.
 * Falls back to the actor id (truncated) so the toast never reads
 * "undefined added Spaghetti Bolognese" — better to read "Member ab12
 * added …" than to lie. The host populates the map from the existing
 * `getMyHousehold` payload.
 */
export function resolvePlanActorDisplayName(
  actorId: string | null,
  members: Map<string, string>,
): string {
  if (!actorId) return "Someone";
  const name = members.get(actorId);
  if (name && name.trim()) return name.trim();
  return `Member ${actorId.slice(0, 4)}`;
}

/**
 * Format the day-and-slot suffix for toast copy: "Tuesday lunch",
 * "Wednesday breakfast", "Friday dinner". Slot label comes from the
 * row's `name`; falls back to "a meal" when missing.
 */
function formatDaySlot(row: MealPlanItemRow, dayLookup: Map<string, PlanDayLookup>): string {
  const day = dayLookup.get(row.plan_day_id);
  const dayLabel = day?.dayLabel?.trim() || "";
  const slotLabel = (row.name ?? "").trim();
  if (dayLabel && slotLabel) return `${dayLabel} ${slotLabel.toLowerCase()}`;
  if (dayLabel) return dayLabel;
  if (slotLabel) return slotLabel;
  return "a meal";
}

/**
 * Format a toast message for a given change event. Mirrors the
 * spec ("Sam added 'Spaghetti Bolognese' to Tuesday lunch" / "Alex
 * updated Wednesday breakfast" / "Sam removed Friday dinner"). Runs
 * the same way on web (sonner toast) and mobile (ToastAndroid /
 * Alert).
 *
 * Returns null when the event came from the subscriber themselves
 * — the caller can use this as a defensive shield even though
 * `subscribePlanChannel` already filters self-events.
 */
export function formatPlanChangeToast(input: {
  event: PlanChangeEvent;
  members: Map<string, string>;
  dayLookup: Map<string, PlanDayLookup>;
  ownUserId: string;
}): string | null {
  const { event, members, dayLookup, ownUserId } = input;
  if (event.actorId && event.actorId === ownUserId) return null;

  const actor = resolvePlanActorDisplayName(event.actorId, members);
  const recipeTitle = (event.row.recipe_title ?? "").trim();
  const daySlot = formatDaySlot(event.row, dayLookup);

  if (event.kind === "insert") {
    if (recipeTitle) {
      return `${actor} added "${recipeTitle}" to ${daySlot}`;
    }
    return `${actor} added a meal to ${daySlot}`;
  }
  if (event.kind === "delete") {
    if (recipeTitle) {
      return `${actor} removed "${recipeTitle}" from ${daySlot}`;
    }
    return `${actor} removed ${daySlot}`;
  }
  // UPDATE — distinguish a swap (recipe title changed) from a
  // portion / macro tweak.
  const prevTitle = (event.previous?.recipe_title ?? "").trim();
  if (prevTitle && recipeTitle && prevTitle !== recipeTitle) {
    return `${actor} swapped ${daySlot} to "${recipeTitle}"`;
  }
  return `${actor} updated ${daySlot}`;
}
