import { describe, expect, it, vi } from "vitest";
import { fetchAllUserSaves } from "../../src/lib/recipes/fetchAllUserSaves";

/**
 * Builds a mock Supabase client whose `.from("saves").select(...).eq(...)
 * .order(...).limit(n).gt("recipe_id", cursor)` chain resolves against an
 * in-memory row set, keyset-paginated by `recipe_id` exactly like Postgres
 * would. Lets us test the pagination LOOP (cursor advance, stop condition,
 * error short-circuit) without a live database.
 */
function mockSupabase(allRows: { recipe_id: string; created_at: string }[]) {
  const fromCalls: string[] = [];
  const from = vi.fn((table: string) => {
    fromCalls.push(table);
    let userIdFilter: string | null = null;
    let cursor: string | null = null;
    let limitN = 1000;
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn((_col: string, val: string) => {
        userIdFilter = val;
        return builder;
      }),
      order: vi.fn(() => builder),
      limit: vi.fn((n: number) => {
        limitN = n;
        return builder;
      }),
      gt: vi.fn((_col: string, val: string) => {
        cursor = val;
        return builder;
      }),
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        const sorted = [...allRows].sort((a, b) => (a.recipe_id < b.recipe_id ? -1 : 1));
        const filtered = sorted.filter((r) => (cursor ? r.recipe_id > cursor : true));
        const page = filtered.slice(0, limitN);
        void userIdFilter;
        resolve({ data: page, error: null });
      },
    };
    return builder;
  });
  return { supabase: { from } as any, fromCalls };
}

describe("fetchAllUserSaves", () => {
  it("returns all rows in one page when under the page size", async () => {
    const rows = [
      { recipe_id: "a", created_at: "2026-01-01" },
      { recipe_id: "b", created_at: "2026-01-02" },
    ];
    const { supabase } = mockSupabase(rows);
    const { rows: out, error } = await fetchAllUserSaves(supabase, "user-1");
    expect(error).toBeNull();
    expect(out.map((r) => r.recipe_id).sort()).toEqual(["a", "b"]);
  });

  it("pages to exhaustion across multiple full pages plus a partial page", async () => {
    // 25 rows, pageSize 10 -> 3 requests (10, 10, 5).
    const rows = Array.from({ length: 25 }, (_, i) => ({
      recipe_id: `r${String(i).padStart(3, "0")}`,
      created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    }));
    const { supabase } = mockSupabase(rows);
    const { rows: out, error } = await fetchAllUserSaves(supabase, "user-1", 10);
    expect(error).toBeNull();
    expect(out).toHaveLength(25);
    expect(new Set(out.map((r) => r.recipe_id)).size).toBe(25);
  });

  it("stops immediately when the saves table is empty", async () => {
    const { supabase } = mockSupabase([]);
    const { rows: out, error } = await fetchAllUserSaves(supabase, "user-1");
    expect(error).toBeNull();
    expect(out).toEqual([]);
  });

  it("returns whatever was accumulated so far plus the error, and stops paging", async () => {
    // `calls` lives OUTSIDE the `from` factory so it persists across the
    // multiple `.from("saves")` calls fetchAllUserSaves makes per page —
    // each pagination iteration re-invokes `.from()` fresh.
    let calls = 0;
    const from = vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn((n: number) => {
          void n;
          return builder;
        }),
        gt: vi.fn(() => builder),
        then(resolve: (v: { data: unknown; error: unknown }) => void) {
          calls += 1;
          if (calls === 1) {
            resolve({
              data: [{ recipe_id: "a", created_at: "2026-01-01" }],
              error: null,
            });
          } else {
            resolve({ data: null, error: { message: "network blip" } });
          }
        },
      };
      return builder;
    });
    const supabase = { from } as any;
    const { rows: out, error } = await fetchAllUserSaves(supabase, "user-1", 1);
    expect(error).toEqual({ message: "network blip" });
    expect(out).toEqual([{ recipe_id: "a", created_at: "2026-01-01" }]);
  });

  it("a recipe saved beyond the default 1000-row page is still returned (the bug this fixes)", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({
      recipe_id: `r${String(i).padStart(4, "0")}`,
      created_at: "2026-01-01",
    }));
    const { supabase } = mockSupabase(rows);
    const { rows: out, error } = await fetchAllUserSaves(supabase, "user-1");
    expect(error).toBeNull();
    expect(out).toHaveLength(1001);
    expect(out.some((r) => r.recipe_id === "r1000")).toBe(true);
  });
});
