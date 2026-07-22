import { afterEach, describe, expect, it, vi } from "vitest";
import { MEAL_SHARE_STORAGE_KEY } from "@/lib/share/mealShareLink";
import {
  createMealShare,
  getMealShare,
  listMealShares,
  revokeMealShare,
  storePendingMealShare,
  takePendingMealShare,
  type SupabaseRpcLike,
  type SupabaseSelectLike,
} from "@/lib/share/mealShareClient";

function stubRpc(result: {
  data: unknown;
  error: { message: string } | null;
}): SupabaseRpcLike & { rpc: ReturnType<typeof vi.fn> } {
  return { rpc: vi.fn(async () => result) };
}

/**
 * Minimal chainable stub for the ONE query shape `listMealShares` issues —
 * `.from("meal_shares").select(cols).eq("created_by", id).order(...).limit(n)`.
 * Mirrors `tests/unit/savedMealsClient.test.ts`'s chain-builder convention
 * (record calls, resolve via a terminal awaitable), scoped down since this
 * client never branches on table name.
 */
function stubSelect(result: { data: unknown; error: { message: string } | null }) {
  const filters: Record<string, unknown> = {};
  let selectedCols = "";
  const self: any = {
    select(cols: string) {
      selectedCols = cols;
      return self;
    },
    eq(col: string, val: unknown) {
      filters[`eq:${col}`] = val;
      return self;
    },
    order(col: string, opts?: unknown) {
      filters[`order:${col}`] = opts ?? true;
      return self;
    },
    limit(n: number) {
      filters["limit"] = n;
      return self;
    },
    then(resolve: (r: typeof result) => void) {
      resolve(result);
    },
  };
  const supabase: SupabaseSelectLike & { from: ReturnType<typeof vi.fn> } = {
    from: vi.fn(() => self),
  };
  return { supabase, filters, selectedCols: () => selectedCols };
}

afterEach(() => {
  // Unstub first — a test that stubbed `window` to undefined leaves it
  // undefined until this runs, and `window.localStorage.clear()` below
  // would throw against an undefined window.
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("createMealShare", () => {
  it("passes through a created status with token + shareId", async () => {
    const supabase = stubRpc({
      data: {
        status: "created",
        token: "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
        share_id: "share-1",
        expires_at: "2026-08-21T00:00:00Z",
      },
      error: null,
    });

    const result = await createMealShare(supabase, {
      title: "Lunch",
      mealSlot: "Lunch",
      items: [{ recipe_title: "X", calories: 1, protein: 1, carbs: 1, fat: 1 }],
    });

    expect(result).toEqual({
      status: "created",
      token: "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
      shareId: "share-1",
    });
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("create_meal_share", {
      p_title: "Lunch",
      p_meal_slot: "Lunch",
      p_items: [{ recipe_title: "X", calories: 1, protein: 1, carbs: 1, fat: 1 }],
    });
  });

  it("passes through rate_limited with no token/shareId", async () => {
    const supabase = stubRpc({ data: { status: "rate_limited" }, error: null });
    const result = await createMealShare(supabase, { title: "Lunch", mealSlot: "Lunch", items: [] });
    expect(result).toEqual({ status: "rate_limited" });
  });

  it("collapses an RPC error to status 'error'", async () => {
    const supabase = stubRpc({ data: null, error: { message: "boom" } });
    const result = await createMealShare(supabase, { title: "Lunch", mealSlot: "Lunch", items: [] });
    expect(result).toEqual({ status: "error" });
  });
});

describe("getMealShare", () => {
  it("short-circuits an invalid token with ZERO rpc calls", async () => {
    const supabase = stubRpc({ data: { status: "ok" }, error: null });
    const result = await getMealShare(supabase, "not-a-valid-token");
    expect(result).toEqual({ status: "invalid" });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("short-circuits an empty token with ZERO rpc calls", async () => {
    const supabase = stubRpc({ data: { status: "ok" }, error: null });
    const result = await getMealShare(supabase, "");
    expect(result).toEqual({ status: "invalid" });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("normalises the token before calling the RPC, then parses an ok payload", async () => {
    const supabase = stubRpc({
      data: {
        status: "ok",
        title: "Lunch",
        meal_slot: "Lunch",
        items: [{ recipe_title: "X", calories: 1, protein: 1, carbs: 1, fat: 1 }],
        shared_by: "Grace",
        created_at: "2026-07-22T09:00:00Z",
      },
      error: null,
    });

    const result = await getMealShare(supabase, "A1B2-C3D4-A1B2-C3D4-A1B2-C3D4-A1B2-C3D4");

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("get_meal_share", {
      p_token: "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.payload.title).toBe("Lunch");
    expect(result.payload.sharedBy).toBe("Grace");
  });

  it("collapses an RPC error to invalid (never claims a share is valid on a network hiccup)", async () => {
    const supabase = stubRpc({ data: null, error: { message: "boom" } });
    const result = await getMealShare(supabase, "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4");
    expect(result).toEqual({ status: "invalid" });
  });

  it("passes through expired/revoked from the RPC payload", async () => {
    const expiredSupabase = stubRpc({ data: { status: "expired" }, error: null });
    expect(await getMealShare(expiredSupabase, "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4")).toEqual({
      status: "expired",
    });

    const revokedSupabase = stubRpc({ data: { status: "revoked" }, error: null });
    expect(await getMealShare(revokedSupabase, "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4")).toEqual({
      status: "revoked",
    });
  });
});

describe("revokeMealShare", () => {
  it("passes through a revoked status", async () => {
    const supabase = stubRpc({ data: { status: "revoked" }, error: null });
    const result = await revokeMealShare(supabase, "share-1");
    expect(result).toEqual({ status: "revoked" });
    expect(supabase.rpc).toHaveBeenCalledWith("revoke_meal_share", { p_share_id: "share-1" });
  });

  it("returns invalid for a blank share id without calling the rpc", async () => {
    const supabase = stubRpc({ data: { status: "revoked" }, error: null });
    const result = await revokeMealShare(supabase, "   ");
    expect(result).toEqual({ status: "invalid" });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("collapses an RPC error to status 'error'", async () => {
    const supabase = stubRpc({ data: null, error: { message: "boom" } });
    const result = await revokeMealShare(supabase, "share-1");
    expect(result).toEqual({ status: "error" });
  });
});

describe("listMealShares (ENG-1648)", () => {
  it("maps snake_case rows to camelCase MealShareListRow, newest-first order preserved", async () => {
    const { supabase, filters } = stubSelect({
      data: [
        {
          id: "share-1",
          title: "Dinner",
          meal_slot: "Dinner",
          created_at: "2026-07-20T00:00:00Z",
          expires_at: "2026-08-19T00:00:00Z",
          revoked_at: null,
        },
        {
          id: "share-2",
          title: "Lunch",
          meal_slot: "Lunch",
          created_at: "2026-07-15T00:00:00Z",
          expires_at: "2026-08-14T00:00:00Z",
          revoked_at: "2026-07-18T00:00:00Z",
        },
      ],
      error: null,
    });

    const result = await listMealShares(supabase, "user-1");

    expect(result).toEqual({
      status: "ok",
      rows: [
        {
          id: "share-1",
          title: "Dinner",
          mealSlot: "Dinner",
          createdAt: "2026-07-20T00:00:00Z",
          expiresAt: "2026-08-19T00:00:00Z",
          revokedAt: null,
        },
        {
          id: "share-2",
          title: "Lunch",
          mealSlot: "Lunch",
          createdAt: "2026-07-15T00:00:00Z",
          expiresAt: "2026-08-14T00:00:00Z",
          revokedAt: "2026-07-18T00:00:00Z",
        },
      ],
    });
    // Order is whatever the query returns — the client trusts the DB's
    // `order("created_at", {ascending:false})`, it doesn't re-sort.
    expect(result.status === "ok" && result.rows[0].id).toBe("share-1");
    expect(filters["eq:created_by"]).toBe("user-1");
    expect(filters["limit"]).toBe(200);
  });

  it("never selects items or token — only the management-list field set", async () => {
    const { supabase, selectedCols } = stubSelect({ data: [], error: null });
    await listMealShares(supabase, "user-1");
    expect(selectedCols()).not.toMatch(/\bitems\b/);
    expect(selectedCols()).not.toMatch(/\btoken\b/);
    expect(selectedCols()).toContain("meal_slot");
  });

  it("collapses a Supabase error to status 'error'", async () => {
    const { supabase } = stubSelect({ data: null, error: { message: "boom" } });
    const result = await listMealShares(supabase, "user-1");
    expect(result).toEqual({ status: "error" });
  });

  it("returns status 'error' for a blank userId without querying", async () => {
    const { supabase } = stubSelect({ data: [], error: null });
    const result = await listMealShares(supabase, "   ");
    expect(result).toEqual({ status: "error" });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("pending meal share localStorage helpers", () => {
  it("stores then takes — take clears the stored value", () => {
    storePendingMealShare("a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4");
    expect(window.localStorage.getItem(MEAL_SHARE_STORAGE_KEY)).toBe(
      "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );

    expect(takePendingMealShare()).toBe("a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4");
    expect(window.localStorage.getItem(MEAL_SHARE_STORAGE_KEY)).toBeNull();
    // Second take is a clean miss, not a replay of the first value.
    expect(takePendingMealShare()).toBeNull();
  });

  it("take returns null when nothing was ever stored", () => {
    expect(takePendingMealShare()).toBeNull();
  });
});

describe("SSR guard — no window", () => {
  it("storePendingMealShare never throws when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => storePendingMealShare("a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4")).not.toThrow();
  });

  it("takePendingMealShare returns null and never throws when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => takePendingMealShare()).not.toThrow();
    expect(takePendingMealShare()).toBeNull();
  });
});
