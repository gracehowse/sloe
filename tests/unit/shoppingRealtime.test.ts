/**
 * Real-time shared shopping cart helpers — PR3 Honeydew parity.
 *
 * Locks the cross-platform contract:
 *   - subscribe / unsubscribe lifecycle on a Supabase Realtime channel
 *   - INSERT / UPDATE / DELETE fan-out to the listener
 *   - self-event filtering (own changes don't toast back)
 *   - toast copy (mirrors mobile ToastAndroid + web sonner)
 *
 * No real Supabase. The `supabase` arg is a hand-rolled stub that
 * captures the channel handlers and lets tests fire payloads
 * synchronously. This is exactly what the helper depends on
 * (channel().on().subscribe()) so the stub is honest about the API.
 */

import { describe, expect, it, vi } from "vitest";
import {
  formatShoppingChangeToast,
  resolveActorDisplayName,
  shoppingRealtimeChannelName,
  subscribeShoppingItemsChannel,
  type ShoppingChangeEvent,
  type ShoppingItemRow,
} from "../../src/lib/household/shoppingRealtime.ts";
import { shoppingScopeFor } from "../../src/lib/household/shoppingScope.ts";

type StubChannel = {
  name: string;
  onCalls: Array<{
    eventType: string;
    config: { event: string; schema: string; table: string; filter: string };
    handler: (payload: any) => void;
  }>;
  subscribed: boolean;
  removed: boolean;
  fire(payload: any): void;
};

function makeStubSupabase() {
  const channels: StubChannel[] = [];
  const supabase = {
    channel(name: string): StubChannel {
      const ch: StubChannel = {
        name,
        onCalls: [],
        subscribed: false,
        removed: false,
        fire(payload: any) {
          for (const c of ch.onCalls) c.handler(payload);
        },
      } as any;
      // Methods must be chainable. Each method returns ch.
      (ch as any).on = (
        eventType: string,
        config: any,
        handler: (payload: any) => void,
      ) => {
        ch.onCalls.push({ eventType, config, handler });
        return ch;
      };
      (ch as any).subscribe = () => {
        ch.subscribed = true;
        return ch;
      };
      channels.push(ch);
      return ch;
    },
    removeChannel(ch: StubChannel) {
      ch.removed = true;
      return Promise.resolve();
    },
  };
  return { supabase, channels };
}

const ROW: ShoppingItemRow = {
  id: "row-1",
  user_id: "alex",
  household_id: "hh-1",
  name: "milk",
  amount: "1",
  unit: "pint",
  category: "Dairy",
  checked: false,
  source: "Plan",
  checked_by: null,
  checked_at: null,
};

describe("shoppingRealtimeChannelName", () => {
  it("uses a per-household channel name in household scope", () => {
    expect(
      shoppingRealtimeChannelName({
        kind: "household",
        userId: "u1",
        householdId: "hh-1",
      }),
    ).toBe("shopping:hh:hh-1");
  });

  it("uses a per-user channel name in solo scope", () => {
    expect(
      shoppingRealtimeChannelName({ kind: "solo", userId: "u1" }),
    ).toBe("shopping:user:u1");
  });
});

describe("subscribeShoppingItemsChannel", () => {
  it("subscribes on mount and uses the household_id filter", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "alex", householdId: "hh-1" });
    const onChange = vi.fn();

    subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange,
    });

    expect(channels).toHaveLength(1);
    expect(channels[0]!.subscribed).toBe(true);
    expect(channels[0]!.name).toBe("shopping:hh:hh-1");
    expect(channels[0]!.onCalls).toHaveLength(1);
    expect(channels[0]!.onCalls[0]!.config.filter).toBe("household_id=eq.hh-1");
    expect(channels[0]!.onCalls[0]!.config.table).toBe("shopping_items");
  });

  it("subscribes with user_id filter in solo scope", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "u1", householdId: null });
    subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: () => {},
    });
    expect(channels[0]!.onCalls[0]!.config.filter).toBe("user_id=eq.u1");
  });

  it("removes the channel when the unsubscribe is called", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "alex", householdId: "hh-1" });
    const unsub = subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: () => {},
    });
    expect(channels[0]!.removed).toBe(false);
    unsub();
    expect(channels[0]!.removed).toBe(true);
  });

  it("fires `insert` events from another household member", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "alex", householdId: "hh-1" });
    const events: ShoppingChangeEvent[] = [];
    subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: (e) => events.push(e),
    });
    // Sam adds an item — INSERT delivered with new=ROW(user_id=sam).
    channels[0]!.fire({
      eventType: "INSERT",
      new: { ...ROW, user_id: "sam", name: "eggs" },
      old: null,
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("insert");
    expect(events[0]!.actorId).toBe("sam");
    expect(events[0]!.row.name).toBe("eggs");
  });

  it("filters out the subscriber's own INSERTs", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "alex", householdId: "hh-1" });
    const events: ShoppingChangeEvent[] = [];
    subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: (e) => events.push(e),
    });
    channels[0]!.fire({
      eventType: "INSERT",
      new: { ...ROW, user_id: "alex" },
      old: null,
    });
    expect(events).toHaveLength(0);
  });

  it("treats a check-toggle UPDATE's actor as `checked_by`, not the row's user_id", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "alex", householdId: "hh-1" });
    const events: ShoppingChangeEvent[] = [];
    subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: (e) => events.push(e),
    });
    // The row was originally created by Alex (user_id=alex). Sam ticks
    // the box — the new row carries `checked_by=sam, checked=true`.
    // Old row had `checked=false`. The actor is Sam, not Alex, so
    // Alex should hear about it via the toast.
    channels[0]!.fire({
      eventType: "UPDATE",
      new: { ...ROW, user_id: "alex", checked: true, checked_by: "sam" },
      old: { ...ROW, user_id: "alex", checked: false, checked_by: null },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("update");
    expect(events[0]!.actorId).toBe("sam");
  });

  it("filters self-toggle UPDATE — Alex ticks her own row, no event", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "alex", householdId: "hh-1" });
    const events: ShoppingChangeEvent[] = [];
    subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: (e) => events.push(e),
    });
    channels[0]!.fire({
      eventType: "UPDATE",
      new: { ...ROW, user_id: "alex", checked: true, checked_by: "alex" },
      old: { ...ROW, user_id: "alex", checked: false, checked_by: null },
    });
    expect(events).toHaveLength(0);
  });

  it("fires `delete` events from another member", () => {
    const { supabase, channels } = makeStubSupabase();
    const scope = shoppingScopeFor({ userId: "alex", householdId: "hh-1" });
    const events: ShoppingChangeEvent[] = [];
    subscribeShoppingItemsChannel({
      supabase: supabase as any,
      scope,
      onChange: (e) => events.push(e),
    });
    channels[0]!.fire({
      eventType: "DELETE",
      new: null,
      old: { ...ROW, user_id: "sam", name: "old-bread" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe("delete");
    expect(events[0]!.row.name).toBe("old-bread");
    expect(events[0]!.actorId).toBe("sam");
  });
});

describe("resolveActorDisplayName", () => {
  it("returns the resolved display name when present", () => {
    const members = new Map<string, string>([["sam", "Sam"]]);
    expect(resolveActorDisplayName("sam", members)).toBe("Sam");
  });

  it("falls back to a recognisable Member-prefix when display name is missing", () => {
    const members = new Map<string, string>();
    expect(resolveActorDisplayName("ab1234567890", members)).toBe("Member ab12");
  });

  it("returns 'Someone' when the actor id is null", () => {
    expect(resolveActorDisplayName(null, new Map())).toBe("Someone");
  });

  it("treats a whitespace-only display name as missing", () => {
    const members = new Map<string, string>([["sam", "  "]]);
    expect(resolveActorDisplayName("sam", members)).toBe("Member sam");
  });
});

describe("formatShoppingChangeToast", () => {
  const members = new Map<string, string>([
    ["sam", "Sam"],
    ["alex", "Alex"],
  ]);

  it("formats an INSERT toast for another member", () => {
    expect(
      formatShoppingChangeToast({
        event: {
          kind: "insert",
          row: { ...ROW, name: "milk" },
          actorId: "sam",
        },
        members,
        ownUserId: "alex",
      }),
    ).toBe('Sam added "milk" to the list');
  });

  it("formats a check-off toast", () => {
    expect(
      formatShoppingChangeToast({
        event: {
          kind: "update",
          row: { ...ROW, name: "eggs", checked: true },
          previous: { ...ROW, name: "eggs", checked: false },
          actorId: "sam",
        },
        members,
        ownUserId: "alex",
      }),
    ).toBe('Sam checked off "eggs"');
  });

  it("formats an uncheck toast", () => {
    expect(
      formatShoppingChangeToast({
        event: {
          kind: "update",
          row: { ...ROW, name: "eggs", checked: false },
          previous: { ...ROW, name: "eggs", checked: true },
          actorId: "sam",
        },
        members,
        ownUserId: "alex",
      }),
    ).toBe('Sam unchecked "eggs"');
  });

  it("formats a delete toast", () => {
    expect(
      formatShoppingChangeToast({
        event: {
          kind: "delete",
          row: { ...ROW, name: "old-bread" },
          actorId: "sam",
        },
        members,
        ownUserId: "alex",
      }),
    ).toBe('Sam removed "old-bread" from the list');
  });

  it("returns null for events fired by the subscriber themselves (defensive)", () => {
    expect(
      formatShoppingChangeToast({
        event: { kind: "insert", row: ROW, actorId: "alex" },
        members,
        ownUserId: "alex",
      }),
    ).toBeNull();
  });

  it("falls back to 'an item' when the row name is empty", () => {
    expect(
      formatShoppingChangeToast({
        event: {
          kind: "insert",
          row: { ...ROW, name: "" },
          actorId: "sam",
        },
        members,
        ownUserId: "alex",
      }),
    ).toBe('Sam added "an item" to the list');
  });
});
