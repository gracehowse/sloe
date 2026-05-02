/**
 * Real-time shared shopping cart — Honeydew-parity ("two phones at
 * Tesco") scope, 2026-04-30 competitor audit gap #8.
 *
 * Pure helper module — no React, no DOM, no React Native. Web
 * (`useShoppingListState.ts`) and mobile (`apps/mobile/app/shopping.tsx`)
 * both consume `subscribeShoppingItemsChannel` to wire a Supabase
 * Realtime channel scoped to the active household, then funnel every
 * INSERT / UPDATE / DELETE event through the shared
 * `formatShoppingChangeToast` helper so the user-visible toast copy
 * is identical across platforms.
 *
 * Schema dependency:
 *   `supabase/migrations/20260504100100_household_shopping.sql` adds
 *   `shopping_items.household_id`, `checked_by`, and `checked_at`,
 *   and adds the table to the `supabase_realtime` publication. The
 *   subscription helper here is harmless without that migration —
 *   the channel will simply receive no events — but the toast
 *   payloads expect the new columns. Apply path: stage the SQL and
 *   run `supabase db push --linked` (per CLAUDE.md, never via MCP).
 *
 * RLS contract:
 *   The same RLS that gates SELECT also gates Realtime payload
 *   delivery. A non-member never receives another household's
 *   change events — there is no client-side trust assumption beyond
 *   "the session token represents the right user". See
 *   `household_shopping_select` policy in the migration above.
 *
 * Self-event filtering:
 *   Realtime delivers the user's OWN changes back to them. We don't
 *   want to toast "You added eggs" — that would feel like a stutter.
 *   `subscribeShoppingItemsChannel` filters out events whose
 *   `user_id` (or `checked_by` for UPDATE-checked) matches the
 *   subscriber's own user id BEFORE invoking the listener.
 */

import type { ShoppingScope } from "./shoppingScope";

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
 */
export type ShoppingItemRow = {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  amount: string | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  source: string | null;
  /** PR3 (2026-04-30) — populated via the new column from
   *  20260504100100_household_shopping.sql. Tells the toast which
   *  household member toggled the row last. */
  checked_by?: string | null;
  checked_at?: string | null;
};

export type ShoppingChangeEvent =
  | { kind: "insert"; row: ShoppingItemRow; actorId: string }
  | { kind: "update"; row: ShoppingItemRow; previous: ShoppingItemRow | null; actorId: string }
  | { kind: "delete"; row: ShoppingItemRow; actorId: string | null };

export type ShoppingChangeListener = (event: ShoppingChangeEvent) => void;

/**
 * Build the channel name for a given scope. Per-household for
 * household scope; per-user for solo (so different solo users on a
 * shared device don't cross-talk). Channel names land in
 * Supabase's broadcast index — keep them stable + unique per scope.
 */
export function shoppingRealtimeChannelName(scope: ShoppingScope): string {
  if (scope.kind === "household") return `shopping:hh:${scope.householdId}`;
  return `shopping:user:${scope.userId}`;
}

/**
 * Subscribe to `shopping_items` change events for the given scope.
 * Returns an unsubscribe function — the caller MUST invoke it on
 * teardown to avoid leaking a channel + websocket frame on every
 * navigation.
 *
 * The listener is invoked AFTER self-events are filtered out (by
 * default — pass `{ includeSelf: true }` for tests). The actor id is
 * surfaced on every event so the host can resolve the actor's
 * display name from the household members map for the toast copy.
 */
export function subscribeShoppingItemsChannel(opts: {
  supabase: SupabaseLike;
  scope: ShoppingScope;
  /** Emit own changes too. Default false. Tests pass `true`. */
  includeSelf?: boolean;
  onChange: ShoppingChangeListener;
}): () => void {
  const { supabase, scope, includeSelf = false, onChange } = opts;
  const ownId = scope.userId;
  const channelName = shoppingRealtimeChannelName(scope);
  const filter =
    scope.kind === "household"
      ? `household_id=eq.${scope.householdId}`
      : `user_id=eq.${scope.userId}`;

  const handle = (payload: any) => {
    const eventType = payload?.eventType ?? payload?.event ?? null;
    if (!eventType) return;
    const row: ShoppingItemRow | null = payload?.new ?? null;
    const old: ShoppingItemRow | null = payload?.old ?? null;

    if (eventType === "INSERT" && row) {
      const actor = row.user_id ?? "";
      if (!includeSelf && actor === ownId) return;
      onChange({ kind: "insert", row, actorId: actor });
      return;
    }
    if (eventType === "UPDATE" && row) {
      // The actor for a check-toggle is `checked_by`; for any other
      // edit it's the row's `user_id` of the writer (we don't have
      // per-row "last_writer" so this is a pragmatic fallback).
      const checkedToggled =
        old != null && old.checked !== row.checked;
      const actor =
        (checkedToggled ? row.checked_by ?? row.user_id : row.user_id) ?? "";
      if (!includeSelf && actor === ownId) return;
      onChange({ kind: "update", row, previous: old, actorId: actor });
      return;
    }
    if (eventType === "DELETE") {
      const target = old ?? row;
      if (!target) return;
      // Postgres DELETE payload only carries the PK by default. We
      // still surface the row id so the host can drop it from local
      // state; toast copy degrades gracefully ("an item was
      // removed") when name is missing.
      const actor = target.user_id ?? null;
      if (!includeSelf && actor === ownId) return;
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
        table: "shopping_items",
        filter,
      },
      handle,
    )
    .subscribe();

  return () => {
    try {
      void supabase.removeChannel(channel);
    } catch {
      /* removeChannel may throw on already-closed sockets — swallow. */
    }
  };
}

/**
 * Resolve a member's display name from the household-members map.
 * Falls back to the actor id (truncated) so the toast never reads
 * "undefined added eggs" — better to read "Member 1234 added eggs"
 * than to lie. The host populates the map from the existing
 * `getMyHousehold` payload.
 */
export function resolveActorDisplayName(
  actorId: string | null,
  members: Map<string, string>,
): string {
  if (!actorId) return "Someone";
  const name = members.get(actorId);
  if (name && name.trim()) return name.trim();
  // Show the first 4 chars of the uuid so the toast reads as
  // "Member ab12 added eggs" — recognisable to the household
  // owner who can map the prefix to a member from the settings
  // surface, without pretending we know who it was.
  return `Member ${actorId.slice(0, 4)}`;
}

/**
 * Format a toast message for a given change event. Mirrors the
 * spec ("Alex added 'milk' to the list" / "Sam checked off
 * 'eggs'"). Runs the same way on web (sonner toast) and mobile
 * (e.g. ToastAndroid / Alert).
 *
 * Returns null when the event came from the subscriber themselves
 * — the caller can use this as a defensive shield even though
 * `subscribeShoppingItemsChannel` already filters self-events.
 */
export function formatShoppingChangeToast(input: {
  event: ShoppingChangeEvent;
  members: Map<string, string>;
  ownUserId: string;
}): string | null {
  const { event, members, ownUserId } = input;
  const actor = resolveActorDisplayName(event.actorId, members);
  const itemName = event.row.name?.trim() || "an item";
  if (event.actorId === ownUserId) return null;

  if (event.kind === "insert") {
    return `${actor} added "${itemName}" to the list`;
  }
  if (event.kind === "delete") {
    return `${actor} removed "${itemName}" from the list`;
  }
  // UPDATE — distinguish a check-toggle from a name/amount edit.
  const prev = event.previous;
  if (prev && prev.checked === false && event.row.checked === true) {
    return `${actor} checked off "${itemName}"`;
  }
  if (prev && prev.checked === true && event.row.checked === false) {
    return `${actor} unchecked "${itemName}"`;
  }
  return `${actor} updated "${itemName}"`;
}
