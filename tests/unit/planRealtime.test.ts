/**
 * Unit tests for `src/lib/household/planRealtime.ts` — Honeydew
 * couples-loop plan-realtime parity (2026-05-02).
 *
 * Mirrors the structure of `shoppingRealtime.test.ts` (PR #39).
 * Pins:
 *   - channel name + filter shape per scope
 *   - subscribe wires postgres_changes; unsubscribe calls removeChannel
 *   - INSERT / UPDATE / DELETE fan-out hits the listener
 *   - self-events are filtered (own changes don't surface)
 *   - solo users get a no-op (no channel created)
 *   - toast copy matches spec ("Sam added '<title>' to Tuesday lunch")
 *   - missing-name fallback never reads "undefined"
 */

import { describe, expect, it, vi } from "vitest";
import {
  formatPlanChangeToast,
  planRealtimeChannelName,
  resolvePlanActorDisplayName,
  subscribePlanChannel,
  unsubscribePlanChannel,
  type MealPlanItemRow,
  type PlanChangeEvent,
  type PlanDayLookup,
} from "@/lib/household/planRealtime";

// ════════════════════════════════════════════════════════════════════
// Test scaffolding — fake Supabase channel
// ════════════════════════════════════════════════════════════════════

type Captured = {
  channelNames: string[];
  onCalls: Array<{
    type: string;
    config: { event: string; schema: string; table: string; filter: string };
  }>;
  subscribed: number;
  removed: any[];
  fire: (payload: any) => void;
};

function makeFakeSupabase(): { supabase: any; captured: Captured } {
  const captured: Captured = {
    channelNames: [],
    onCalls: [],
    subscribed: 0,
    removed: [],
    fire: () => undefined,
  };
  let handler: ((payload: any) => void) | null = null;
  const channelObj: any = {
    on(type: string, config: any, cb: (payload: any) => void) {
      captured.onCalls.push({ type, config });
      handler = cb;
      return channelObj;
    },
    subscribe() {
      captured.subscribed += 1;
      return channelObj;
    },
  };
  captured.fire = (payload: any) => {
    if (handler) handler(payload);
  };
  const supabase = {
    channel(name: string) {
      captured.channelNames.push(name);
      return channelObj;
    },
    removeChannel(c: any) {
      captured.removed.push(c);
    },
  };
  return { supabase, captured };
}

function row(overrides: Partial<MealPlanItemRow> = {}): MealPlanItemRow {
  return {
    id: "meal-1",
    plan_day_id: "day-1",
    household_id: "hh-1",
    name: "Lunch",
    recipe_title: "Spaghetti Bolognese",
    slot_index: 1,
    calories: 500,
    protein: 30,
    carbs: 60,
    fat: 15,
    ...overrides,
  };
}

function dayLookup(
  overrides: Record<string, PlanDayLookup> = {},
): Map<string, PlanDayLookup> {
  const m = new Map<string, PlanDayLookup>();
  m.set("day-1", { day: 3, dayLabel: "Tuesday", ownerUserId: "user-other" });
  m.set("day-2", { day: 4, dayLabel: "Wednesday", ownerUserId: "user-other" });
  for (const k of Object.keys(overrides)) m.set(k, overrides[k]!);
  return m;
}

function members(overrides: Record<string, string> = {}): Map<string, string> {
  const m = new Map<string, string>();
  m.set("user-other", "Sam");
  m.set("user-third", "Alex");
  for (const k of Object.keys(overrides)) m.set(k, overrides[k]!);
  return m;
}

// ════════════════════════════════════════════════════════════════════
// Channel name + scope
// ════════════════════════════════════════════════════════════════════

describe("planRealtimeChannelName", () => {
  it("uses household scope for households", () => {
    expect(
      planRealtimeChannelName({
        kind: "household",
        householdId: "hh-abc",
        userId: "u",
      }),
    ).toBe("plan:hh:hh-abc");
  });

  it("uses user scope for solo", () => {
    expect(
      planRealtimeChannelName({ kind: "solo", userId: "user-7" }),
    ).toBe("plan:user:user-7");
  });
});

// ════════════════════════════════════════════════════════════════════
// subscribePlanChannel — wiring
// ════════════════════════════════════════════════════════════════════

describe("subscribePlanChannel", () => {
  it("creates a household-scoped channel with the right filter", () => {
    const { supabase, captured } = makeFakeSupabase();
    subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: dayLookup(),
      onChange: () => undefined,
    });
    expect(captured.channelNames).toEqual(["plan:hh:hh-1"]);
    expect(captured.onCalls).toHaveLength(1);
    expect(captured.onCalls[0]?.type).toBe("postgres_changes");
    expect(captured.onCalls[0]?.config).toEqual({
      event: "*",
      schema: "public",
      table: "meal_plan_meals",
      filter: "household_id=eq.hh-1",
    });
    expect(captured.subscribed).toBe(1);
  });

  it("returns a no-op for solo users (no channel created)", () => {
    const { supabase, captured } = makeFakeSupabase();
    const onChange = vi.fn();
    const unsub = subscribePlanChannel({
      supabase,
      householdId: null,
      currentUserId: "user-self",
      dayLookup: dayLookup(),
      onChange,
    });
    expect(captured.channelNames).toEqual([]);
    expect(captured.subscribed).toBe(0);
    // No-op unsub should not throw and should not call removeChannel.
    unsub();
    expect(captured.removed).toEqual([]);
  });

  it("unsubscribe calls removeChannel", () => {
    const { supabase, captured } = makeFakeSupabase();
    const unsub = subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: dayLookup(),
      onChange: () => undefined,
    });
    unsub();
    expect(captured.removed).toHaveLength(1);
  });

  it("INSERT events fan out to onChange", () => {
    const { supabase, captured } = makeFakeSupabase();
    const onChange = vi.fn();
    subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: dayLookup(),
      onChange,
    });
    captured.fire({ eventType: "INSERT", new: row() });
    expect(onChange).toHaveBeenCalledTimes(1);
    const event = onChange.mock.calls[0]![0] as PlanChangeEvent;
    expect(event.kind).toBe("insert");
    expect(event.row.recipe_title).toBe("Spaghetti Bolognese");
    expect(event.actorId).toBe("user-other");
  });

  it("UPDATE events surface previous + new row", () => {
    const { supabase, captured } = makeFakeSupabase();
    const onChange = vi.fn();
    subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: dayLookup(),
      onChange,
    });
    captured.fire({
      eventType: "UPDATE",
      old: row({ recipe_title: "Stir Fry" }),
      new: row({ recipe_title: "Spaghetti Bolognese" }),
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const event = onChange.mock.calls[0]![0] as PlanChangeEvent;
    expect(event.kind).toBe("update");
    if (event.kind !== "update") throw new Error("expected update");
    expect(event.previous?.recipe_title).toBe("Stir Fry");
    expect(event.row.recipe_title).toBe("Spaghetti Bolognese");
  });

  it("DELETE events fan out using the old row", () => {
    const { supabase, captured } = makeFakeSupabase();
    const onChange = vi.fn();
    subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: dayLookup(),
      onChange,
    });
    captured.fire({ eventType: "DELETE", old: row() });
    expect(onChange).toHaveBeenCalledTimes(1);
    const event = onChange.mock.calls[0]![0] as PlanChangeEvent;
    expect(event.kind).toBe("delete");
    expect(event.row.id).toBe("meal-1");
    expect(event.actorId).toBe("user-other");
  });

  it("filters self-events on INSERT (own user is the day owner)", () => {
    const { supabase, captured } = makeFakeSupabase();
    const onChange = vi.fn();
    subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: new Map<string, PlanDayLookup>([
        ["day-1", { day: 3, dayLabel: "Tuesday", ownerUserId: "user-self" }],
      ]),
      onChange,
    });
    captured.fire({ eventType: "INSERT", new: row() });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("includes self-events when includeSelf is true", () => {
    const { supabase, captured } = makeFakeSupabase();
    const onChange = vi.fn();
    subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: new Map<string, PlanDayLookup>([
        ["day-1", { day: 3, dayLabel: "Tuesday", ownerUserId: "user-self" }],
      ]),
      includeSelf: true,
      onChange,
    });
    captured.fire({ eventType: "INSERT", new: row() });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores payloads with no eventType", () => {
    const { supabase, captured } = makeFakeSupabase();
    const onChange = vi.fn();
    subscribePlanChannel({
      supabase,
      householdId: "hh-1",
      currentUserId: "user-self",
      dayLookup: dayLookup(),
      onChange,
    });
    captured.fire({ new: row() });
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// unsubscribePlanChannel — error swallowing
// ════════════════════════════════════════════════════════════════════

describe("unsubscribePlanChannel", () => {
  it("swallows errors from removeChannel", () => {
    const supabase = {
      channel: () => undefined,
      removeChannel: () => {
        throw new Error("socket closed");
      },
    } as any;
    expect(() => unsubscribePlanChannel(supabase, {})).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// resolvePlanActorDisplayName — fallbacks
// ════════════════════════════════════════════════════════════════════

describe("resolvePlanActorDisplayName", () => {
  it("returns the member display name when known", () => {
    expect(
      resolvePlanActorDisplayName("user-other", members()),
    ).toBe("Sam");
  });

  it("falls back to a uuid prefix when name missing", () => {
    expect(
      resolvePlanActorDisplayName("user-other-very-long-uuid", new Map()),
    ).toBe("Member user");
  });

  it("returns 'Someone' for null actor", () => {
    expect(resolvePlanActorDisplayName(null, members())).toBe("Someone");
  });

  it("trims whitespace-only display names to the fallback", () => {
    const m = new Map<string, string>([["user-other", "   "]]);
    expect(resolvePlanActorDisplayName("user-other", m)).toBe("Member user");
  });
});

// ════════════════════════════════════════════════════════════════════
// formatPlanChangeToast — copy spec
// ════════════════════════════════════════════════════════════════════

describe("formatPlanChangeToast", () => {
  it("INSERT — 'Sam added \"Spaghetti Bolognese\" to Tuesday lunch'", () => {
    const message = formatPlanChangeToast({
      event: { kind: "insert", row: row(), actorId: "user-other" },
      members: members(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBe(
      'Sam added "Spaghetti Bolognese" to Tuesday lunch',
    );
  });

  it("UPDATE (swap) — 'Alex swapped Wednesday breakfast to \"Pancakes\"'", () => {
    const message = formatPlanChangeToast({
      event: {
        kind: "update",
        row: row({
          plan_day_id: "day-2",
          name: "Breakfast",
          recipe_title: "Pancakes",
        }),
        previous: row({
          plan_day_id: "day-2",
          name: "Breakfast",
          recipe_title: "Toast",
        }),
        actorId: "user-third",
      },
      members: members(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBe(
      'Alex swapped Wednesday breakfast to "Pancakes"',
    );
  });

  it("UPDATE (no title change) — 'Alex updated Wednesday breakfast'", () => {
    const message = formatPlanChangeToast({
      event: {
        kind: "update",
        row: row({
          plan_day_id: "day-2",
          name: "Breakfast",
          recipe_title: "Pancakes",
          portion_multiplier: 1.5,
        }),
        previous: row({
          plan_day_id: "day-2",
          name: "Breakfast",
          recipe_title: "Pancakes",
          portion_multiplier: 1,
        }),
        actorId: "user-third",
      },
      members: members(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBe("Alex updated Wednesday breakfast");
  });

  it("DELETE — 'Sam removed \"Spaghetti Bolognese\" from Tuesday lunch'", () => {
    const message = formatPlanChangeToast({
      event: { kind: "delete", row: row(), actorId: "user-other" },
      members: members(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBe(
      'Sam removed "Spaghetti Bolognese" from Tuesday lunch',
    );
  });

  it("returns null for own changes (defensive shield)", () => {
    const message = formatPlanChangeToast({
      event: { kind: "insert", row: row(), actorId: "user-self" },
      members: members(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBeNull();
  });

  it("falls back to 'a meal' when day + slot are both missing", () => {
    const message = formatPlanChangeToast({
      event: {
        kind: "insert",
        row: row({ plan_day_id: "unknown-day", name: "" }),
        actorId: "user-other",
      },
      members: members(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBe('Sam added "Spaghetti Bolognese" to a meal');
  });

  it("INSERT with empty recipe title — 'Sam added a meal to Tuesday lunch'", () => {
    const message = formatPlanChangeToast({
      event: {
        kind: "insert",
        row: row({ recipe_title: "" }),
        actorId: "user-other",
      },
      members: members(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBe("Sam added a meal to Tuesday lunch");
  });

  it("uses 'Member <prefix>' attribution when display name is missing", () => {
    const message = formatPlanChangeToast({
      event: { kind: "insert", row: row(), actorId: "abc-1234-uuid" },
      members: new Map(),
      dayLookup: dayLookup(),
      ownUserId: "user-self",
    });
    expect(message).toBe(
      'Member abc- added "Spaghetti Bolognese" to Tuesday lunch',
    );
  });
});
