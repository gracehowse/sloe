/**
 * Real-time meal-plan editing — wiring test (Honeydew couples-loop
 * parity, 2026-05-02). Mirrors the structure of
 * `shoppingRealtimeWiring.test.tsx` from PR #39.
 *
 * Mounts a minimal React harness that drives `subscribePlanChannel`
 * the way `AppDataContext.tsx` and `apps/mobile/app/(tabs)/planner.tsx`
 * drive it, and verifies the user-observable contract:
 *
 *   - subscribes to `meal_plan_meals` Supabase Realtime channel on
 *     mount when the user is in a household
 *   - filter is `household_id=eq.<id>`
 *   - INSERT events from another household member fire the toast +
 *     trigger the host-supplied refetch
 *   - UPDATE events fire toast + refetch
 *   - DELETE events fire toast + refetch
 *   - self-events (own user is the day owner) are filtered (no
 *     toast, no refetch)
 *   - solo users (householdId === null) get NO channel and NO
 *     refetch on simulated payloads (defensive — payloads can't
 *     reach a no-op subscription, but we exercise the API surface)
 *   - unmount calls removeChannel
 *
 * The Supabase client is mocked at the import boundary so the test
 * never opens a websocket. Toast surfaces are tracked via spies.
 */

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

void React;

// ════════════════════════════════════════════════════════════════════
// Channel + Supabase fakes (vi.hoisted so the module mock can read
// them — ESM `vi.mock` factories run before module-scope code).
// ════════════════════════════════════════════════════════════════════

const { channelRegistry, supabaseStub } = vi.hoisted(() => {
  type Capture = {
    eventType: string;
    config: any;
    handler: (payload: any) => void;
  };
  type StubChannel = {
    name: string;
    captures: Capture[];
    subscribed: boolean;
    removed: boolean;
    fire(payload: any): void;
    on(eventType: string, config: any, handler: (payload: any) => void): StubChannel;
    subscribe(): StubChannel;
  };
  const channelRegistry: {
    all: StubChannel[];
    reset(): void;
    live(): StubChannel | null;
  } = {
    all: [],
    reset() {
      this.all = [];
    },
    live() {
      return [...this.all].reverse().find((c) => !c.removed && c.subscribed) ?? null;
    },
  };
  const supabaseStub = {
    channel(name: string): StubChannel {
      const ch: StubChannel = {
        name,
        captures: [],
        subscribed: false,
        removed: false,
        fire(payload: any) {
          if (!ch.subscribed || ch.removed) return;
          for (const c of ch.captures) c.handler(payload);
        },
        on(eventType, config, handler) {
          ch.captures.push({ eventType, config, handler });
          return ch;
        },
        subscribe() {
          ch.subscribed = true;
          return ch;
        },
      };
      channelRegistry.all.push(ch);
      return ch;
    },
    removeChannel(ch: StubChannel) {
      ch.removed = true;
      return Promise.resolve();
    },
  };
  return { channelRegistry, supabaseStub };
});

import {
  subscribePlanChannel,
  formatPlanChangeToast,
  type PlanChangeEvent,
  type PlanDayLookup,
} from "../../src/lib/household/planRealtime";

// ════════════════════════════════════════════════════════════════════
// Harness — the minimal slice of AppDataContext / planner.tsx that
// owns the realtime subscription. Keeps the test self-contained and
// quick (no Next.js / Expo bootstrapping).
// ════════════════════════════════════════════════════════════════════

type HarnessProps = {
  userId: string;
  householdId: string | null;
  members: Map<string, string>;
  dayLookup: Map<string, PlanDayLookup>;
  onToast: (message: string) => void;
  onRefetch: () => void;
};

function PlanRealtimeHarness(props: HarnessProps) {
  const { userId, householdId, members, dayLookup, onToast, onRefetch } = props;
  React.useEffect(() => {
    const unsub = subscribePlanChannel({
      supabase: supabaseStub as any,
      householdId,
      currentUserId: userId,
      dayLookup,
      onChange: (event: PlanChangeEvent) => {
        const message = formatPlanChangeToast({
          event,
          members,
          dayLookup,
          ownUserId: userId,
        });
        if (message) onToast(message);
        onRefetch();
      },
    });
    return unsub;
  }, [userId, householdId, members, dayLookup, onToast, onRefetch]);
  return null;
}

const dayLookup = new Map<string, PlanDayLookup>([
  [
    "day-tue",
    { day: 3, dayLabel: "Tuesday", ownerUserId: "user-self" },
  ],
  [
    "day-wed",
    { day: 4, dayLabel: "Wednesday", ownerUserId: "user-other" },
  ],
]);

const members = new Map<string, string>([
  ["user-self", "Alex"],
  ["user-other", "Sam"],
]);

beforeEach(() => {
  channelRegistry.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe("plan realtime — wiring", () => {
  it("subscribes to meal_plan_meals with household_id filter on mount", async () => {
    render(
      <PlanRealtimeHarness
        userId="user-self"
        householdId="hh-1"
        members={members}
        dayLookup={dayLookup}
        onToast={() => undefined}
        onRefetch={() => undefined}
      />,
    );

    await waitFor(() => {
      const live = channelRegistry.live();
      expect(live).not.toBeNull();
      expect(live!.name).toBe("plan:hh:hh-1");
      expect(live!.captures).toHaveLength(1);
      expect(live!.captures[0]!.config).toEqual({
        event: "*",
        schema: "public",
        table: "meal_plan_meals",
        filter: "household_id=eq.hh-1",
      });
    });
  });

  it("INSERT from another member triggers toast + refetch", async () => {
    const onToast = vi.fn();
    const onRefetch = vi.fn();

    render(
      <PlanRealtimeHarness
        userId="user-self"
        householdId="hh-1"
        members={members}
        dayLookup={dayLookup}
        onToast={onToast}
        onRefetch={onRefetch}
      />,
    );

    let live: ReturnType<typeof channelRegistry.live> = null;
    await waitFor(() => {
      live = channelRegistry.live();
      expect(live).not.toBeNull();
    });

    act(() => {
      live!.fire({
        eventType: "INSERT",
        new: {
          id: "meal-1",
          plan_day_id: "day-wed",
          household_id: "hh-1",
          name: "Breakfast",
          recipe_title: "Pancakes",
          slot_index: 0,
          calories: 400,
          protein: 12,
          carbs: 60,
          fat: 10,
        },
        old: null,
      });
    });

    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith(
      'Sam added "Pancakes" to Wednesday breakfast',
    );
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it("UPDATE (swap) from another member triggers swap toast + refetch", async () => {
    const onToast = vi.fn();
    const onRefetch = vi.fn();
    render(
      <PlanRealtimeHarness
        userId="user-self"
        householdId="hh-1"
        members={members}
        dayLookup={dayLookup}
        onToast={onToast}
        onRefetch={onRefetch}
      />,
    );

    let live: ReturnType<typeof channelRegistry.live> = null;
    await waitFor(() => {
      live = channelRegistry.live();
      expect(live).not.toBeNull();
    });

    act(() => {
      live!.fire({
        eventType: "UPDATE",
        old: {
          id: "meal-2",
          plan_day_id: "day-wed",
          household_id: "hh-1",
          name: "Lunch",
          recipe_title: "Salad",
          slot_index: 1,
          calories: 350,
          protein: 12,
          carbs: 30,
          fat: 12,
        },
        new: {
          id: "meal-2",
          plan_day_id: "day-wed",
          household_id: "hh-1",
          name: "Lunch",
          recipe_title: "Burrito",
          slot_index: 1,
          calories: 600,
          protein: 30,
          carbs: 60,
          fat: 20,
        },
      });
    });

    expect(onToast).toHaveBeenCalledWith(
      'Sam swapped Wednesday lunch to "Burrito"',
    );
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it("DELETE from another member triggers remove toast + refetch", async () => {
    const onToast = vi.fn();
    const onRefetch = vi.fn();
    render(
      <PlanRealtimeHarness
        userId="user-self"
        householdId="hh-1"
        members={members}
        dayLookup={dayLookup}
        onToast={onToast}
        onRefetch={onRefetch}
      />,
    );

    let live: ReturnType<typeof channelRegistry.live> = null;
    await waitFor(() => {
      live = channelRegistry.live();
      expect(live).not.toBeNull();
    });

    act(() => {
      live!.fire({
        eventType: "DELETE",
        old: {
          id: "meal-3",
          plan_day_id: "day-wed",
          household_id: "hh-1",
          name: "Dinner",
          recipe_title: "Stir Fry",
          slot_index: 2,
          calories: 500,
          protein: 30,
          carbs: 50,
          fat: 15,
        },
        new: null,
      });
    });

    expect(onToast).toHaveBeenCalledWith(
      'Sam removed "Stir Fry" from Wednesday dinner',
    );
    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it("self-events do NOT toast (own user is the day owner)", async () => {
    const onToast = vi.fn();
    const onRefetch = vi.fn();
    render(
      <PlanRealtimeHarness
        userId="user-self"
        householdId="hh-1"
        members={members}
        dayLookup={dayLookup}
        onToast={onToast}
        onRefetch={onRefetch}
      />,
    );

    let live: ReturnType<typeof channelRegistry.live> = null;
    await waitFor(() => {
      live = channelRegistry.live();
      expect(live).not.toBeNull();
    });

    act(() => {
      live!.fire({
        eventType: "INSERT",
        new: {
          id: "meal-self",
          // day-tue is owned by user-self in the lookup
          plan_day_id: "day-tue",
          household_id: "hh-1",
          name: "Lunch",
          recipe_title: "Sandwich",
          slot_index: 1,
          calories: 400,
          protein: 18,
          carbs: 40,
          fat: 14,
        },
        old: null,
      });
    });

    // Self-event filtered: helper does not invoke onChange at all.
    expect(onToast).not.toHaveBeenCalled();
    expect(onRefetch).not.toHaveBeenCalled();
  });

  it("solo user (no household) creates no channel and no toast on simulated payload", async () => {
    const onToast = vi.fn();
    const onRefetch = vi.fn();
    render(
      <PlanRealtimeHarness
        userId="user-self"
        householdId={null}
        members={members}
        dayLookup={dayLookup}
        onToast={onToast}
        onRefetch={onRefetch}
      />,
    );

    // No channel was ever created for solo users — the registry
    // should be empty.
    await waitFor(() => {
      expect(channelRegistry.all).toHaveLength(0);
    });
    expect(onToast).not.toHaveBeenCalled();
    expect(onRefetch).not.toHaveBeenCalled();
  });

  it("unmount tears the channel down", async () => {
    const { unmount } = render(
      <PlanRealtimeHarness
        userId="user-self"
        householdId="hh-1"
        members={members}
        dayLookup={dayLookup}
        onToast={() => undefined}
        onRefetch={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(channelRegistry.live()).not.toBeNull();
    });

    unmount();

    // The channel that was live should now be marked removed.
    await waitFor(() => {
      expect(channelRegistry.all.every((c) => c.removed || !c.subscribed)).toBe(true);
    });
  });
});
