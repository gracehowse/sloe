import { describe, expect, it, vi } from "vitest";
import { DISCOVER_POPULAR_MIN_SAVES, fetchPublicRecipeSaveCounts } from "../../src/lib/recipes/fetchPublicRecipeSaveCounts";

describe("fetchPublicRecipeSaveCounts", () => {
  it("calls batched RPC once and merges rows (zero saves omitted)", async () => {
    const rpc = vi.fn(async (name: string, args: { p_recipe_ids?: string[] }) => {
      expect(name).toBe("public_recipe_save_counts_batch");
      const ids = args.p_recipe_ids ?? [];
      return {
        data: ids
          .filter((id) => id !== "c")
          .map((id) => ({ recipe_id: id, save_count: id === "a" ? 12 : 99 })),
        error: null,
      };
    });
    const supabase = { rpc } as any;
    const map = await fetchPublicRecipeSaveCounts(supabase, ["a", "b", "c"]);
    expect(map.get("a")).toBe(12);
    expect(map.get("b")).toBe(99);
    expect(map.get("c")).toBe(0);
    expect(rpc.mock.calls.length).toBe(1);
  });

  it("defaults to 0 on batch RPC error", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "nope" } }));
    const map = await fetchPublicRecipeSaveCounts({ rpc } as any, ["x"]);
    expect(map.get("x")).toBe(0);
  });

  it("uses multiple batch calls when id count exceeds 500", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `id-${i}`);
    const rpc = vi.fn(async (_name: string, args: { p_recipe_ids: string[] }) => ({
      data: args.p_recipe_ids.map((id) => ({ recipe_id: id, save_count: 7 })),
      error: null,
    }));
    const map = await fetchPublicRecipeSaveCounts({ rpc } as any, ids);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(map.get("id-0")).toBe(7);
    expect(map.get("id-500")).toBe(7);
  });
});

describe("DISCOVER_POPULAR_MIN_SAVES", () => {
  it("matches discover filter contract (web + mobile)", () => {
    expect(DISCOVER_POPULAR_MIN_SAVES).toBe(50);
  });
});
