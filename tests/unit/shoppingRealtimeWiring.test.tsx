/**
 * Real-time shared shopping cart — wiring test (PR3, Honeydew
 * parity, 2026-04-30 audit gap #8).
 *
 * Mounts `useShoppingListState` (the canonical web entry point used
 * by `AppDataContext`) and verifies the new realtime path:
 *
 *   - subscribes to a `shopping_items` Supabase Realtime channel on
 *     mount when the user is authenticated
 *   - the filter is `household_id=eq.<id>` after the household
 *     resolves, OR `user_id=eq.<id>` for solo users
 *   - INSERT events from another household member append a row to
 *     local state and surface a sonner toast
 *   - DELETE events remove the row from local state
 *   - the subscription is torn down on unmount
 *
 * The Supabase client is mocked at the import boundary so the test
 * never opens a websocket. The household client is mocked to
 * resolve the user into a household with a second member, so the
 * "Sam added milk" toast lands.
 */

import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

void React;

const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(toastSpy, {
    success: toastSpy,
    error: toastSpy,
    warning: toastSpy,
    message: toastSpy,
  }),
}));

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
  // Track every channel created so the test can assert on the
  // latest live one (not a stale removed instance).
  const channelRegistry: { all: StubChannel[]; reset(): void; latest(): StubChannel | null; live(): StubChannel | null } = {
    all: [],
    reset() {
      this.all = [];
    },
    latest() {
      return this.all.at(-1) ?? null;
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
          // Only deliver if the channel is still subscribed and
          // hasn't been removed — mirrors real Supabase behaviour.
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
    from() {
      return {
        select() {
          return {
            limit: () => ({ data: [], error: null }),
            eq: () => ({ order: () => ({ data: [], error: null }) }),
            order: () => ({ data: [], error: null }),
          };
        },
      };
    },
  };
  return { channelRegistry, supabaseStub };
});

vi.mock("../../src/lib/supabase/browserClient", () => ({
  supabase: supabaseStub,
}));

vi.mock("../../src/lib/supabase/shoppingJsonFallback", () => ({
  fetchShoppingListJsonItems: vi.fn(async () => ({ items: [] })),
  probeAnyShoppingListJsonTable: vi.fn(async () => false),
}));

vi.mock("../../src/lib/household/householdClient", () => ({
  getMyHousehold: vi.fn(async () => ({
    data: {
      household: { id: "hh-1", name: "Home", ownerId: "alex" },
      members: [
        { userId: "alex", displayName: "Alex" },
        { userId: "sam", displayName: "Sam" },
      ],
      meals: [],
    },
    error: null,
  })),
}));

import { useShoppingListState } from "../../src/context/appData/useShoppingListState";

beforeEach(() => {
  toastSpy.mockReset();
  channelRegistry.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useShoppingListState — realtime wiring (PR3)", () => {
  it("subscribes to shopping_items with household_id filter once household resolves", async () => {
    renderHook(() =>
      useShoppingListState({ authedUserId: "alex", initialItems: [] }),
    );

    await waitFor(() => {
      const live = channelRegistry.live();
      expect(live).not.toBeNull();
      expect(live!.captures[0]!.config.table).toBe("shopping_items");
      // Once the household resolves, the LIVE channel uses the
      // household-scoped filter. Older per-user channel(s) (if any)
      // should be `removed`.
      expect(live!.captures[0]!.config.filter).toBe("household_id=eq.hh-1");
    });
  });

  it("appends a row to state and toasts when another member inserts", async () => {
    const { result } = renderHook(() =>
      useShoppingListState({ authedUserId: "alex", initialItems: [] }),
    );

    // Wait for the household-scoped channel to be live.
    let live: ReturnType<typeof channelRegistry.live> = null;
    await waitFor(() => {
      live = channelRegistry.live();
      expect(live).not.toBeNull();
      expect(live!.captures[0]!.config.filter).toBe("household_id=eq.hh-1");
    });

    act(() => {
      live!.fire({
        eventType: "INSERT",
        new: {
          id: "row-1",
          user_id: "sam",
          household_id: "hh-1",
          name: "milk",
          amount: "1",
          unit: "pint",
          category: "Dairy",
          checked: false,
          source: "Plan",
          checked_by: null,
          checked_at: null,
        },
        old: null,
      });
    });

    await waitFor(() => {
      expect(result.current.shoppingItems).toHaveLength(1);
      expect(result.current.shoppingItems[0]!.name).toBe("milk");
    });

    expect(toastSpy).toHaveBeenCalled();
    const lastToast = toastSpy.mock.calls.at(-1);
    expect(lastToast?.[0]).toBe('Sam added "milk" to the list');
  });

  it("removes a row and toasts when another member deletes", async () => {
    const { result } = renderHook(() =>
      useShoppingListState({
        authedUserId: "alex",
        initialItems: [
          {
            id: "row-2",
            name: "eggs",
            amount: "12",
            unit: "",
            category: "Dairy",
            checked: false,
            from: "Plan",
          },
        ],
      }),
    );

    let live: ReturnType<typeof channelRegistry.live> = null;
    await waitFor(() => {
      live = channelRegistry.live();
      expect(live).not.toBeNull();
      expect(live!.captures[0]!.config.filter).toBe("household_id=eq.hh-1");
    });

    act(() => {
      live!.fire({
        eventType: "DELETE",
        new: null,
        old: {
          id: "row-2",
          user_id: "sam",
          household_id: "hh-1",
          name: "eggs",
          amount: "12",
          unit: "",
          category: "Dairy",
          checked: false,
          source: "Plan",
        },
      });
    });

    await waitFor(() => {
      expect(result.current.shoppingItems).toHaveLength(0);
    });

    const lastToast = toastSpy.mock.calls.at(-1);
    expect(lastToast?.[0]).toBe('Sam removed "eggs" from the list');
  });

  it("ignores the user's own change events (no self-toast)", async () => {
    const { result } = renderHook(() =>
      useShoppingListState({ authedUserId: "alex", initialItems: [] }),
    );

    let live: ReturnType<typeof channelRegistry.live> = null;
    await waitFor(() => {
      live = channelRegistry.live();
      expect(live).not.toBeNull();
      expect(live!.captures[0]!.config.filter).toBe("household_id=eq.hh-1");
    });

    const before = toastSpy.mock.calls.length;
    act(() => {
      live!.fire({
        eventType: "INSERT",
        new: {
          id: "row-self",
          user_id: "alex", // own user — should be filtered.
          household_id: "hh-1",
          name: "self-bread",
          amount: "1",
          unit: "loaf",
          category: "Bakery",
          checked: false,
          source: "Plan",
        },
        old: null,
      });
    });
    // Channel listener filters out self-events — no toast, no
    // append. Local state stays at 0.
    expect(result.current.shoppingItems).toHaveLength(0);
    expect(toastSpy.mock.calls.length).toBe(before);
  });

  it("tears down the channel on unmount", async () => {
    const { unmount } = renderHook(() =>
      useShoppingListState({ authedUserId: "alex", initialItems: [] }),
    );

    // Wait for the household-resolved live channel to land.
    await waitFor(() => {
      expect(channelRegistry.live()).not.toBeNull();
    });

    unmount();

    await waitFor(() => {
      // After unmount, every channel that ever existed is removed.
      expect(channelRegistry.live()).toBeNull();
      expect(channelRegistry.all.length).toBeGreaterThan(0);
      for (const ch of channelRegistry.all) {
        expect(ch.removed).toBe(true);
      }
    });
  });
});
