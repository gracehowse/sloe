/**
 * Honeydew parity (2026-04-30) — `useShoppingListState` household scope.
 *
 * Pins the read/write/realtime paths in
 * `src/context/appData/useShoppingListState.ts`:
 *  - solo user reads filter `user_id = me AND household_id IS NULL`
 *  - household user reads filter `household_id = active`
 *  - INSERT carries `household_id` when in a household, `null` when solo
 *  - real-time subscription uses the right channel + filter for scope
 *
 * Mocks supabase via the `browserClient` module so we can capture the
 * actual chain (`from().select().eq().is().order()`). This is the
 * source-of-truth contract — the `shoppingScope` helper tests cover
 * the pure-function rules; this test covers their wiring into the
 * runtime hook.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

void React;

// ── Supabase chainable mock ────────────────────────────────────────
// `vi.hoisted` is required because `vi.mock` factories run before
// any top-level `const`s; without it, the mock factory closures
// reference an uninitialised `mockSupabase`.

const { calls, channelCalls, mockSupabase } = vi.hoisted(() => {
  type Chain = {
    table: string;
    op: "select" | "insert" | "update" | "delete";
    filters: Array<[string, string, unknown]>;
    payload?: unknown;
  };
  const calls: Chain[] = [];
  const channelCalls: Array<{ name: string; filter: string }> = [];
  const selectResult = { data: [], error: null };

  function makeChainable(table: string) {
    let op: Chain["op"] = "select";
    let payload: unknown;
    const filters: Array<[string, string, unknown]> = [];

    const self: any = {
      select: () => self,
      insert: (p: unknown) => {
        op = "insert";
        payload = p;
        return self;
      },
      update: (p: unknown) => {
        op = "update";
        payload = p;
        return self;
      },
      delete: () => {
        op = "delete";
        return self;
      },
      eq: (col: string, val: unknown) => {
        filters.push([col, "eq", val]);
        return self;
      },
      is: (col: string, val: unknown) => {
        filters.push([col, "is", val]);
        return self;
      },
      in: (col: string, vals: unknown) => {
        filters.push([col, "in", vals]);
        return self;
      },
      order: () => self,
      limit: () => self,
      single: async () => {
        calls.push({ table, op, filters, payload });
        return selectResult;
      },
      maybeSingle: async () => {
        calls.push({ table, op, filters, payload });
        return selectResult;
      },
      then: (resolve: (r: unknown) => void) => {
        calls.push({ table, op, filters, payload });
        resolve(selectResult);
      },
    };
    return self;
  }

  const mockSupabase = {
    from: (table: string) => makeChainable(table),
    channel: (name: string) => {
      const obj: Record<string, unknown> = {
        on: (
          _event: string,
          params: { filter?: string },
          _cb: () => void,
        ) => {
          channelCalls.push({ name, filter: params?.filter ?? "" });
          return obj;
        },
        subscribe: () => obj,
      };
      return obj;
    },
    removeChannel: () => {},
  };

  return { calls, channelCalls, mockSupabase };
});

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: mockSupabase,
}));

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn() },
}));

// useRetryEnableDbTable starts a polling effect we don't care about.
vi.mock("../../src/context/appData/useRetryEnableDbTable.ts", () => ({
  useRetryEnableDbTable: () => {},
}));

import { useShoppingListState } from "../../src/context/appData/useShoppingListState";

function HookHarness({
  authedUserId,
  activeHouseholdId,
}: {
  authedUserId: string | null;
  activeHouseholdId: string | null;
}) {
  useShoppingListState({
    authedUserId,
    initialItems: [],
    activeHouseholdId,
  });
  return null;
}

beforeEach(() => {
  calls.length = 0;
  channelCalls.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useShoppingListState — household scope (Honeydew parity)", () => {
  it("solo user reads filter by user_id AND household_id IS NULL", async () => {
    render(<HookHarness authedUserId="u-solo" activeHouseholdId={null} />);
    // Allow effect microtasks to flush.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const reads = calls.filter(
      (c) => c.table === "shopping_items" && c.op === "select",
    );
    expect(reads.length).toBeGreaterThan(0);
    const reload = reads[reads.length - 1];
    // Solo path applies BOTH eq:user_id and is:household_id null.
    expect(
      reload.filters.find(
        ([col, fop, val]) => col === "user_id" && fop === "eq" && val === "u-solo",
      ),
    ).toBeDefined();
    expect(
      reload.filters.find(
        ([col, fop, val]) => col === "household_id" && fop === "is" && val === null,
      ),
    ).toBeDefined();
  });

  it("household user reads filter by household_id only (members see each other)", async () => {
    render(<HookHarness authedUserId="u-member" activeHouseholdId="h-1" />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const reads = calls.filter(
      (c) => c.table === "shopping_items" && c.op === "select",
    );
    expect(reads.length).toBeGreaterThan(0);
    const reload = reads[reads.length - 1];
    expect(
      reload.filters.find(
        ([col, fop, val]) => col === "household_id" && fop === "eq" && val === "h-1",
      ),
    ).toBeDefined();
    // The whole point of household mode: do NOT also filter by user_id.
    expect(
      reload.filters.find(([col]) => col === "user_id"),
    ).toBeUndefined();
  });

  it("household real-time subscription is keyed on household_id", async () => {
    render(<HookHarness authedUserId="u-member" activeHouseholdId="h-1" />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(channelCalls.length).toBeGreaterThan(0);
    const last = channelCalls[channelCalls.length - 1];
    expect(last.name).toContain("hh:h-1");
    expect(last.filter).toBe("household_id=eq.h-1");
  });

  it("solo real-time subscription is keyed on user_id (cross-device sync)", async () => {
    render(<HookHarness authedUserId="u-solo" activeHouseholdId={null} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(channelCalls.length).toBeGreaterThan(0);
    const last = channelCalls[channelCalls.length - 1];
    expect(last.name).toContain("user:u-solo");
    expect(last.filter).toBe("user_id=eq.u-solo");
  });
});
