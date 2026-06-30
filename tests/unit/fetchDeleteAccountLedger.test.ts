import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDeleteAccountLedger } from "@/lib/settings/fetchDeleteAccountLedger";

/**
 * ENG-1270 — the DeleteAccount step-2 removal ledger must read each table by
 * its REAL owner column. The original bug filtered `recipes` by `user_id`
 * (column doesn't exist → query errors) and read `profiles.weight_by_day`
 * (column doesn't exist → undefined), and a single shared `catch` blanked the
 * WHOLE ledger to null — so the live sheet showed an empty "nothing will be
 * removed" list on an irreversible flow.
 *
 * ENG-1263 — the red-✕ "removed" recipes row must count ONLY what is hard-
 * deleted: saved recipes (`saves`) + UNPUBLISHED authored drafts
 * (`recipes WHERE author_id = user AND published = false`). Published authored
 * recipes survive de-attributed (`author_id = null`) and must NOT be counted
 * here — bundling them over-promised deletion. So the recipes query MUST carry
 * BOTH `.eq("author_id", user)` AND `.eq("published", false)`; a revert that
 * drops the published filter would over-count and these tests fail.
 *
 * These tests pin each query against a fake client whose schema mirrors the
 * generated `database.types.ts`: querying a NON-EXISTENT column raises a
 * Postgres-shaped error (code 42703), and filtering by the WRONG existing
 * column matches zero rows. So a revert to any wrong owner column makes the
 * affected count read 0/null instead of the seeded data-rich value, and the
 * assertions below fail.
 */

const USER_ID = "user-data-rich-1";

/**
 * Real owner columns per table (from `database.types.ts`). A query that filters
 * a table by anything other than its owner column matches no rows; a query that
 * names a column the table doesn't have raises a 42703 error.
 */
const TABLE_SCHEMA: Record<
  string,
  { columns: Set<string>; ownerColumn: string }
> = {
  nutrition_entries: {
    columns: new Set(["id", "user_id", "calories", "date_key"]),
    ownerColumn: "user_id",
  },
  recipes: {
    // No `user_id` column exists on recipes — author_id / creator_id only.
    columns: new Set(["id", "author_id", "creator_id", "title", "published"]),
    ownerColumn: "author_id",
  },
  saves: {
    columns: new Set(["recipe_id", "user_id", "created_at"]),
    ownerColumn: "user_id",
  },
  profiles: {
    // No `weight_by_day` column — the real JSONB map is `weight_kg_by_day`.
    columns: new Set(["id", "weight_kg_by_day", "household_id", "weight_kg"]),
    ownerColumn: "id",
  },
  household_members: {
    columns: new Set(["id", "user_id", "household_id", "role"]),
    ownerColumn: "user_id",
  },
};

type Seed = {
  counts: Record<string, number>; // table -> exact row count for USER_ID
  // Authored recipes split by `published` (ENG-1263). The ledger must count
  // ONLY unpublished drafts; published authored recipes survive de-attributed.
  // `counts.recipes`, when present, is the UNPUBLISHED-draft count the
  // author_id+published=false query should resolve to. `publishedRecipes` is
  // the count the fake would return if the published filter were dropped — set
  // it > 0 to prove the published filter is actually applied (a revert that
  // dropped `.eq("published", false)` would surface this larger number).
  publishedRecipes?: number;
  weightKgByDay: Record<string, number> | null;
  householdId: string | null;
};

function unknownColumnError(table: string, column: string) {
  return {
    code: "42703",
    message: `column ${table}.${column} does not exist`,
    details: null,
    hint: null,
  };
}

/**
 * Minimal Supabase-query-builder fake. Records the table + selected columns +
 * filters, validates every referenced column against `TABLE_SCHEMA`, and
 * resolves to a `{ data, count, error }` shape matching the real client.
 */
function makeFakeClient(seed: Seed) {
  const calls: Array<{ table: string; filterColumn: string | null }> = [];

  function builder(table: string) {
    const schema = TABLE_SCHEMA[table];
    let selectColumns: string[] = [];
    let head = false;
    // Chained `.eq()` filters accumulate (PostgREST ANDs them together).
    const filters: Array<{ column: string; value: unknown }> = [];

    const filterFor = (column: string): { value: unknown } | undefined =>
      filters.find((f) => f.column === column);

    // Any referenced column not in the table's schema → unknown-column error,
    // surfaced on the resolved query (PostgREST behaviour).
    const columnError = (): { code: string; message: string } | null => {
      if (!schema) return { code: "42P01", message: `relation "${table}" does not exist` };
      for (const col of selectColumns) {
        if (!schema.columns.has(col)) return unknownColumnError(table, col);
      }
      for (const f of filters) {
        if (!schema.columns.has(f.column)) return unknownColumnError(table, f.column);
      }
      return null;
    };

    const rowCountForFilter = (): number => {
      if (!schema) return 0;
      const owner = filterFor(schema.ownerColumn);
      // The owner column must be matched to USER_ID to return any seeded rows.
      if (!owner || owner.value !== USER_ID) return 0;

      // recipes: the ledger counts UNPUBLISHED authored drafts only (ENG-1263).
      // Honour the `published` filter — only `published = false` returns the
      // seeded draft count; a query that DROPPED the published filter would
      // (incorrectly) return drafts + published, surfacing `publishedRecipes`.
      if (table === "recipes") {
        const published = filterFor("published");
        const drafts = seed.counts.recipes ?? 0;
        const publishedCount = seed.publishedRecipes ?? 0;
        if (!published) return drafts + publishedCount; // no published filter → over-counts
        return published.value === false ? drafts : publishedCount;
      }

      return seed.counts[table] ?? 0;
    };

    const resolveCount = () => {
      const error = columnError();
      if (error) return { data: null, count: null, error };
      return { data: head ? null : [], count: rowCountForFilter(), error: null };
    };

    const api = {
      select(cols: string, opts?: { count?: string; head?: boolean }) {
        selectColumns = cols.split(",").map((c) => c.trim());
        head = Boolean(opts?.head);
        return api;
      },
      eq(column: string, value: unknown) {
        filters.push({ column, value });
        calls.push({ table, filterColumn: column });
        // Count queries (head:true) resolve on `eq`; single-row reads chain to
        // `.maybeSingle()` instead, so only resolve here when a count was asked.
        return api;
      },
      maybeSingle() {
        const error = columnError();
        if (error) return Promise.resolve({ data: null, error });
        const owner = filterFor(schema?.ownerColumn ?? "");
        if (!owner || owner.value !== USER_ID) {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({
          data: {
            id: USER_ID,
            weight_kg_by_day: seed.weightKgByDay,
            household_id: seed.householdId,
          },
          error: null,
        });
      },
      // Count queries are awaited directly after `.eq()` — make the builder
      // thenable so `await supabase.from(...).select(...).eq(...)` resolves.
      then(onFulfilled: (v: ReturnType<typeof resolveCount>) => unknown) {
        return Promise.resolve(resolveCount()).then(onFulfilled);
      },
    };
    return api;
  }

  return {
    client: { from: (table: string) => builder(table) },
    calls,
  };
}

describe("fetchDeleteAccountLedger — owner columns (ENG-1270)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("returns NON-ZERO counts for a data-rich user across every owned table", async () => {
    const { client } = makeFakeClient({
      counts: {
        nutrition_entries: 128,
        recipes: 7, // unpublished authored DRAFTS (hard-deleted)
        saves: 5, // saved (hard-deleted)
        household_members: 1,
      },
      publishedRecipes: 11, // published authored recipes — survive, NOT counted
      weightKgByDay: { "2026-06-01": 70, "2026-06-02": 69.8, "2026-06-03": 69.6 },
      householdId: "household-1",
    });

    const rows = await fetchDeleteAccountLedger(client, USER_ID);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.label]));

    // Diary: nutrition_entries.user_id
    expect(byId.diary).toBe("128 diary entries");
    // Recipes REMOVED: unpublished drafts (recipes.author_id + published=false
    // = 7) + saved (saves.user_id = 5) = 12. The 11 PUBLISHED authored recipes
    // are de-attributed, not deleted → excluded. If the published filter were
    // dropped, the count would (wrongly) be 7 + 11 + 5 = 23.
    expect(byId.recipes).toBe("12 saved recipes & drafts");
    // Weight: profiles.weight_kg_by_day has 3 keys
    expect(byId.weight).toBe("3 days of weight history");
    // Household: membership row + profile household_id
    expect(byId.household).toBe("Your household membership");

    // No swallowed errors on the happy path — all owner columns are correct.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("counts authored recipes via author_id (revert to user_id would read 0)", async () => {
    const { client, calls } = makeFakeClient({
      counts: { nutrition_entries: 0, recipes: 9, saves: 0, household_members: 0 },
      weightKgByDay: {},
      householdId: null,
    });

    const rows = await fetchDeleteAccountLedger(client, USER_ID);
    const recipesRow = rows.find((r) => r.id === "recipes");

    // 9 drafts + 0 saved = 9. If the filter regressed to `user_id`, the fake
    // would raise 42703 → count null → "9" would never appear.
    expect(recipesRow?.label).toBe("9 saved recipes & drafts");
    expect(calls).toContainEqual({ table: "recipes", filterColumn: "author_id" });
    expect(calls).not.toContainEqual({ table: "recipes", filterColumn: "user_id" });
  });

  it("EXCLUDES published authored recipes from the removed count (ENG-1263)", async () => {
    // The user has only published authored recipes (no drafts) + a couple of
    // saves. Published recipes survive de-attributed, so the removed count must
    // be the saves alone — NOT saves + published.
    const { client, calls } = makeFakeClient({
      counts: { nutrition_entries: 0, recipes: 0, saves: 2, household_members: 0 },
      publishedRecipes: 40, // many published recipes — none should be counted
      weightKgByDay: {},
      householdId: null,
    });

    const rows = await fetchDeleteAccountLedger(client, USER_ID);
    const recipesRow = rows.find((r) => r.id === "recipes");

    // 0 drafts + 2 saved = 2. A revert that dropped `.eq("published", false)`
    // would surface 0 + 40 + 2 = 42 and this assertion would fail.
    expect(recipesRow?.label).toBe("2 saved recipes & drafts");
    // The recipes query MUST carry the published filter.
    expect(calls).toContainEqual({ table: "recipes", filterColumn: "published" });
  });

  it("reads weight history from weight_kg_by_day (revert to weight_by_day reads 0)", async () => {
    const { client } = makeFakeClient({
      counts: { nutrition_entries: 0, recipes: 0, saves: 0, household_members: 0 },
      weightKgByDay: {
        "2026-05-01": 80,
        "2026-05-02": 79.9,
        "2026-05-03": 79.7,
        "2026-05-04": 79.5,
      },
      householdId: null,
    });

    const rows = await fetchDeleteAccountLedger(client, USER_ID);
    const weightRow = rows.find((r) => r.id === "weight");

    // 4 days. A revert to selecting `weight_by_day` raises 42703 → null →
    // "Weight & body history" generic label, never "4 days of weight history".
    expect(weightRow?.label).toBe("4 days of weight history");
  });

  it("does NOT blank every count when the recipes queries fail (per-count isolation)", async () => {
    // Force BOTH recipe sources (authored + saved) to error by stripping their
    // owner columns from the schema for this run, while every other table stays
    // healthy. This is the strongest isolation assertion: even a fully-failed
    // recipes row must not zero or blank diary / weight / household.
    const seed: Seed = {
      counts: { nutrition_entries: 50, recipes: 3, saves: 2, household_members: 1 },
      weightKgByDay: { "2026-06-10": 72 },
      householdId: "household-x",
    };
    const originalRecipes = TABLE_SCHEMA.recipes;
    const originalSaves = TABLE_SCHEMA.saves;
    TABLE_SCHEMA.recipes = { columns: new Set(["id", "title"]), ownerColumn: "author_id" };
    TABLE_SCHEMA.saves = { columns: new Set(["created_at"]), ownerColumn: "user_id" };
    try {
      const { client } = makeFakeClient(seed);
      const rows = await fetchDeleteAccountLedger(client, USER_ID);
      const byId = Object.fromEntries(rows.map((r) => [r.id, r.label]));

      // Both recipe sources failed → the row degrades to its generic label…
      expect(byId.recipes).toBe("Saved recipes & drafts"); // generic / unknown
      // …but the other rows still carry their live counts (not blanked).
      expect(byId.diary).toBe("50 diary entries");
      expect(byId.weight).toBe("1 day of weight history");
      expect(byId.household).toBe("Your household membership");

      // The failures were logged loudly rather than silently swallowed.
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      TABLE_SCHEMA.recipes = originalRecipes;
      TABLE_SCHEMA.saves = originalSaves;
    }
  });

  it("shows a partial-but-truthful total when only one recipe source fails", async () => {
    // Authored query fails, saved query succeeds → show the saved count rather
    // than blanking the whole row. Truthful partial beats a falsely-empty row
    // on a destructive flow.
    const seed: Seed = {
      counts: { nutrition_entries: 0, recipes: 4, saves: 6, household_members: 0 },
      weightKgByDay: {},
      householdId: null,
    };
    const originalRecipes = TABLE_SCHEMA.recipes;
    TABLE_SCHEMA.recipes = { columns: new Set(["id", "title"]), ownerColumn: "author_id" };
    try {
      const { client } = makeFakeClient(seed);
      const rows = await fetchDeleteAccountLedger(client, USER_ID);
      const recipesRow = rows.find((r) => r.id === "recipes");
      // 0 (drafts, failed) + 6 (saved) = 6.
      expect(recipesRow?.label).toBe("6 saved recipes & drafts");
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      TABLE_SCHEMA.recipes = originalRecipes;
    }
  });

  it("returns generic labels for an empty userId without querying", async () => {
    const { client, calls } = makeFakeClient({
      counts: {},
      weightKgByDay: null,
      householdId: null,
    });
    const rows = await fetchDeleteAccountLedger(client, "");
    expect(rows.map((r) => r.id)).toEqual(["diary", "recipes", "weight", "household"]);
    expect(rows.find((r) => r.id === "diary")?.label).toBe("Food diary entries");
    expect(calls).toHaveLength(0);
  });
});
