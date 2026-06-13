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
});
