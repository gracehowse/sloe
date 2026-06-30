/**
 * Integration tests for GET /api/export/me — the "Export everything"
 * server endpoint that counters lock-in anxiety per the 2026-04-30
 * user-sentiment audit.
 *
 * Coverage:
 *   - 401 unauthenticated.
 *   - 503 when service-role key isn't configured.
 *   - 200 happy path with the full payload shape, JSON
 *     `Content-Disposition`, and `Cache-Control: no-store`.
 *   - 429 on second call within the rate-limit window (1 / 60s).
 *
 * Notes:
 *   - The Supabase client is mocked with a thenable chain so
 *     `from(...).select().eq().gte().order()` resolves to a fixed
 *     fixture without a real network call.
 *   - We don't assert on the analytics fire-and-forget — the route
 *     uses `void serverTrack(...)`, and `NEXT_PUBLIC_POSTHOG_KEY`
 *     is unset in the test env so the call short-circuits to
 *     `{ ok: false, reason: "no_project_key" }`. That's by design.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(),
}));

import { GET } from "../../app/api/export/me/route";
import {
  SUPPR_EXPORT_SCHEMA_VERSION,
  SUPPR_EXPORT_LOG_DAYS,
} from "@/lib/export/exportEverythingSchema";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { rateLimit } from "@/lib/server/rateLimit";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCreateServiceClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;
const mockRateLimit = rateLimit as ReturnType<typeof vi.fn>;

function mockRequest(): Request {
  return new Request("http://localhost/api/export/me", { method: "GET" });
}

/** A thenable result that also exposes the chain methods Supabase
 *  filter builders use. Returns the same `{ data, error }` no
 *  matter how deep the chain goes. */
function chainable<T>(result: { data: T; error: unknown }) {
   
  const p: any = Promise.resolve(result);
  p.eq = () => chainable(result);
  p.in = () => chainable(result);
  p.gte = () => chainable(result);
  p.order = () => chainable(result);
  p.maybeSingle = () => Promise.resolve(result);
  return p;
}

/** Build a fake supabase client whose every `.from(...)` returns a
 *  thenable filter chain that resolves to the per-table fixture. */
function fakeClient(fixtures: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => {
      const data =
        Object.prototype.hasOwnProperty.call(fixtures, table)
          ? fixtures[table]
          : [];
      return {
        select: vi.fn(() =>
          chainable({ data, error: null }),
        ),
      };
    }),
  };
}

describe("GET /api/export/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default rate-limit pass.
    mockRateLimit.mockResolvedValue({ ok: true, remaining: 0, resetAtMs: Date.now() + 60_000 });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await GET(mockRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 503 when service-role key is missing", async () => {
    mockGetUserId.mockResolvedValue("user-123");
    mockCreateServiceClient.mockReturnValue(null);
    const res = await GET(mockRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("service_unavailable");
  });

  it("returns 429 with Retry-After when rate-limited", async () => {
    mockGetUserId.mockResolvedValue("user-123");
    mockRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetAtMs: Date.now() + 30_000,
      retryAfterSec: 30,
      ip: "1.2.3.4",
    });
    const res = await GET(mockRequest());
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("rate_limited");
  });

  it("returns 200 JSON with the full shape, attachment header, and no-store cache", async () => {
    mockGetUserId.mockResolvedValue("user-123");
    const profileRow = { id: "user-123", display_name: "Grace" };
    const recipeRows = [{ id: "r1", title: "Pasta" }];
    const ingredientRows = [{ id: "i1", recipe_id: "r1", name: "tomato" }];
    const mealLogRows = [{ id: "n1", date_key: "2026-04-30", calories: 500 }];
    const weightRows = [{ id: 1, captured_at: "2026-04-29T08:00:00Z", weight_kg: 70 }];
    const customFoodRows = [{ id: "c1", name: "MyShake" }];
    const planDayRows = [{ id: "d1", plan_id: "p1" }];
    const planMealRows = [{ id: "m1", plan_day_id: "d1" }];
    const shoppingRows = [{ id: "s1", item: "milk", is_active: true }];
    const savedMealRows = [{ id: "sm1", name: "Breakfast bowl" }];
    const savedMealItemRows = [{ id: "smi1", saved_meal_id: "sm1" }];
    const recipeNoteRows = [{ id: "rn1", recipe_id: "r1", note: "delicious" }];
    const saveRows = [{ id: "sv1", user_id: "user-123", recipe_id: "r1" }];
    const householdMembershipRows = [
      { id: "hm1", user_id: "user-123", household_id: "hh1", role: "owner" },
    ];

    const client = fakeClient({
      profiles: profileRow,
      recipes: recipeRows,
      saves: saveRows,
      nutrition_entries: mealLogRows,
      health_snapshots: weightRows,
      user_custom_foods: customFoodRows,
      meal_plan_days: planDayRows,
      meal_plan_meals: planMealRows,
      shopping_items: shoppingRows,
      user_saved_meals: savedMealRows,
      user_saved_meal_items: savedMealItemRows,
      user_recipe_notes: recipeNoteRows,
      recipe_ingredients: ingredientRows,
      household_members: householdMembershipRows,
    });
    mockCreateServiceClient.mockReturnValue(client as never);

    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const dispo = res.headers.get("content-disposition") ?? "";
    expect(dispo).toMatch(/attachment;\s*filename="suppr-export-user-123-\d{4}-\d{2}-\d{2}\.json"/);

    const body = await res.json();
    expect(body.schemaVersion).toBe(SUPPR_EXPORT_SCHEMA_VERSION);
    expect(body.windowDays).toBe(SUPPR_EXPORT_LOG_DAYS);
    expect(body.userId).toBe("user-123");
    expect(typeof body.exportedAt).toBe("string");
    expect(body.profile).toEqual(profileRow);
    expect(body.recipes).toEqual(recipeRows);
    expect(body.recipeIngredients).toEqual(ingredientRows);
    expect(body.saves).toEqual(saveRows);
    expect(body.mealLog).toEqual(mealLogRows);
    expect(body.weightHistory).toEqual(weightRows);
    expect(body.customFoods).toEqual(customFoodRows);
    // `plans` was removed in export schema v2 (ENG-850) — the `meal_plans`
    // table was dropped 2026-04-21; plan data lives in planDays + planMeals.
    expect(body.plans).toBeUndefined();
    expect(body.planDays).toEqual(planDayRows);
    expect(body.planMeals).toEqual(planMealRows);
    expect(body.shopping).toEqual(shoppingRows);
    expect(body.savedMeals).toEqual(savedMealRows);
    expect(body.savedMealItems).toEqual(savedMealItemRows);
    expect(body.recipeNotes).toEqual(recipeNoteRows);
    expect(body.householdMemberships).toEqual(householdMembershipRows);
  });

  it("degrades gracefully when an optional table is missing", async () => {
    mockGetUserId.mockResolvedValue("user-456");
    // user_recipe_notes throws a "could not find the table" error;
    // every other table returns its fixture.
    const client = {
      from: vi.fn((table: string) => {
        if (table === "user_recipe_notes") {
          return {
            select: vi.fn(() =>
              chainable({
                data: null,
                error: { message: "could not find the table", code: "PGRST205" },
              }),
            ),
          };
        }
        return {
          select: vi.fn(() => chainable({ data: [], error: null })),
        };
      }),
    };
    mockCreateServiceClient.mockReturnValue(client as never);

    const res = await GET(mockRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipeNotes).toEqual([]);
    expect(Array.isArray(body.mealLog)).toBe(true);
  });

  it("scopes the rate limit to the authenticated userId (1 export / 60s)", async () => {
    mockGetUserId.mockResolvedValue("user-789");
    mockCreateServiceClient.mockReturnValue(fakeClient({}) as never);
    await GET(mockRequest());
    expect(mockRateLimit).toHaveBeenCalledTimes(1);
    const args = mockRateLimit.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      keyPrefix: "api:export:me",
      limit: 1,
      windowMs: 60_000,
      userId: "user-789",
    });
  });

  // ENG-1262 (data-export surface): prove per-user row isolation. Every
  // table read MUST be filtered by the authenticated caller's id; passing a
  // different authed user must NOT surface another user's rows. We build a
  // filter-aware fake client that only returns a row when the `.eq(...)`
  // matches the row's owner column — so if the route ever dropped the
  // `.eq(userId)` (or used the wrong column), the assertion fails.
  describe("per-user isolation (no cross-user leakage)", () => {
    /** Filter-aware thenable: records every `.eq(col, val)` and resolves to
     *  only the fixture rows whose owner column matches ALL recorded filters. */
    function isolatedChain(
      rows: Record<string, unknown>[],
      filters: Array<[string, unknown]>,
    ) {

      const ownerCols = [
        "user_id",
        "id",
        "author_id",
        "recipe_id",
        "plan_day_id",
        "saved_meal_id",
      ];
      const apply = () =>
        rows.filter((r) =>
          filters.every(([col, val]) => {
            // Only enforce ownership columns; ignore window / status filters
            // (date_key, captured_at, is_active) which aren't ownership scoping.
            if (ownerCols.includes(col)) return r[col] === val;
            return true;
          }),
        );


      const p: any = Promise.resolve({ data: apply(), error: null });
      p.eq = (col: string, val: unknown) =>
        isolatedChain(rows, [...filters, [col, val]]);
      p.in = (col: string, vals: unknown[]) =>
        isolatedChain(
          rows.filter((r) => (vals as unknown[]).includes(r[col])),
          filters,
        );
      p.gte = () => isolatedChain(rows, filters);
      p.order = () => isolatedChain(rows, filters);
      p.maybeSingle = () => {
        const matched = apply();
        return Promise.resolve({ data: matched[0] ?? null, error: null });
      };
      return p;
    }

    function isolatedClient(
      rowsByTable: Record<string, Record<string, unknown>[]>,
    ) {
      return {
        from: vi.fn((table: string) => ({
          select: vi.fn(() => isolatedChain(rowsByTable[table] ?? [], [])),
        })),
      };
    }

    // Two users' data live in the SAME tables. Only the authed user's rows
    // should ever appear in the payload.
    const rowsByTable: Record<string, Record<string, unknown>[]> = {
      profiles: [
        { id: "owner", display_name: "Owner" },
        { id: "intruder", display_name: "Intruder" },
      ],
      recipes: [
        { id: "r-own", author_id: "owner", title: "Owner pasta" },
        { id: "r-other", author_id: "intruder", title: "Intruder cake" },
      ],
      saves: [
        { id: "sv-own", user_id: "owner" },
        { id: "sv-other", user_id: "intruder" },
      ],
      nutrition_entries: [
        { id: "n-own", user_id: "owner", calories: 100 },
        { id: "n-other", user_id: "intruder", calories: 999 },
      ],
      health_snapshots: [
        { id: "h-own", user_id: "owner", weight_kg: 70 },
        { id: "h-other", user_id: "intruder", weight_kg: 50 },
      ],
      user_custom_foods: [
        { id: "cf-own", user_id: "owner" },
        { id: "cf-other", user_id: "intruder" },
      ],
      meal_plan_days: [
        { id: "d-own", user_id: "owner" },
        { id: "d-other", user_id: "intruder" },
      ],
      meal_plan_meals: [
        { id: "m-own", plan_day_id: "d-own" },
        { id: "m-other", plan_day_id: "d-other" },
      ],
      shopping_items: [
        { id: "sh-own", user_id: "owner", is_active: true },
        { id: "sh-other", user_id: "intruder", is_active: true },
      ],
      user_saved_meals: [
        { id: "sm-own", user_id: "owner" },
        { id: "sm-other", user_id: "intruder" },
      ],
      user_saved_meal_items: [
        { id: "smi-own", saved_meal_id: "sm-own" },
        { id: "smi-other", saved_meal_id: "sm-other" },
      ],
      user_recipe_notes: [
        { id: "rn-own", user_id: "owner" },
        { id: "rn-other", user_id: "intruder" },
      ],
      recipe_ingredients: [
        { id: "ing-own", recipe_id: "r-own" },
        { id: "ing-other", recipe_id: "r-other" },
      ],
      // Two memberships in the SAME table, scoped by `user_id`. The export
      // MUST filter on `user_id` (never `household_id`) — otherwise a shared
      // household would leak the co-member's row into this user's export.
      household_members: [
        { id: "hm-own", user_id: "owner" },
        { id: "hm-other", user_id: "intruder" },
      ],
    };

    it("returns ONLY the authed user's rows, never another user's", async () => {
      mockGetUserId.mockResolvedValue("owner");
      mockCreateServiceClient.mockReturnValue(
        isolatedClient(rowsByTable) as never,
      );

      const res = await GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();

      // Profile is the owner's, never the intruder's.
      expect(body.profile?.id).toBe("owner");
      // The whole serialized payload must not contain ANY intruder marker.
      expect(JSON.stringify(body)).not.toContain("intruder");
      expect(JSON.stringify(body)).not.toContain("-other");

      // Every section contains only owner-scoped ids.
      expect(body.recipes.map((r: { id: string }) => r.id)).toEqual(["r-own"]);
      expect(body.recipeIngredients.map((r: { id: string }) => r.id)).toEqual([
        "ing-own",
      ]);
      expect(body.saves.map((r: { id: string }) => r.id)).toEqual(["sv-own"]);
      expect(body.mealLog.map((r: { id: string }) => r.id)).toEqual(["n-own"]);
      expect(body.weightHistory.map((r: { id: string }) => r.id)).toEqual([
        "h-own",
      ]);
      expect(body.customFoods.map((r: { id: string }) => r.id)).toEqual([
        "cf-own",
      ]);
      expect(body.planDays.map((r: { id: string }) => r.id)).toEqual(["d-own"]);
      expect(body.planMeals.map((r: { id: string }) => r.id)).toEqual(["m-own"]);
      expect(body.shopping.map((r: { id: string }) => r.id)).toEqual(["sh-own"]);
      expect(body.savedMeals.map((r: { id: string }) => r.id)).toEqual([
        "sm-own",
      ]);
      expect(body.savedMealItems.map((r: { id: string }) => r.id)).toEqual([
        "smi-own",
      ]);
      expect(body.recipeNotes.map((r: { id: string }) => r.id)).toEqual([
        "rn-own",
      ]);
      // Household memberships are scoped to the authed caller — the
      // co-member ("hm-other", user_id: intruder) must NOT appear.
      expect(
        body.householdMemberships.map((r: { id: string }) => r.id),
      ).toEqual(["hm-own"]);
    });

    it("swapping the authed user swaps the rows (proves the filter is the userId)", async () => {
      mockGetUserId.mockResolvedValue("intruder");
      mockCreateServiceClient.mockReturnValue(
        isolatedClient(rowsByTable) as never,
      );

      const res = await GET(mockRequest());
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.profile?.id).toBe("intruder");
      expect(JSON.stringify(body)).not.toContain("r-own");
      expect(body.recipes.map((r: { id: string }) => r.id)).toEqual(["r-other"]);
      expect(body.mealLog.map((r: { id: string }) => r.id)).toEqual(["n-other"]);
      expect(body.weightHistory.map((r: { id: string }) => r.id)).toEqual([
        "h-other",
      ]);
      // Swapping the authed user swaps the household membership row too —
      // proves the export filters on the caller's `user_id`, not household_id.
      expect(
        body.householdMemberships.map((r: { id: string }) => r.id),
      ).toEqual(["hm-other"]);
    });
  });
});
