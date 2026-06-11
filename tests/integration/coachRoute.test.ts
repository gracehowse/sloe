/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/nutrition/coach — the "what to eat
 * next" coach engine route.
 *
 * Covers: auth, body validation, deterministic candidate assembly from
 * the user's saved library, the AI re-rank/phrase path (mocked), and —
 * critically — every AI failure path falling back to the deterministic
 * order so the surface NEVER goes empty. No live AI calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
  createSupabaseServiceRoleClient: vi.fn(),
}));
vi.mock("@/lib/server/serverEnv", () => ({
  misconfiguredServiceRoleResponse: vi.fn(() => null),
}));
vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, remaining: 119, resetAtMs: 0 })),
}));
vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async () => false),
}));
vi.mock("@/lib/observability/captureRouteError", () => ({
  captureRouteError: vi.fn(),
}));
vi.mock("@/lib/server/aiProvider", () => ({
  callAiText: vi.fn(),
  AiBudgetExceededError: class AiBudgetExceededError extends Error {
    retryAfterSec = 3600;
  },
}));

import { POST } from "../../app/api/nutrition/coach/route";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import {
  callAiText,
  AiBudgetExceededError,
} from "@/lib/server/aiProvider";

const mockGetUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCreateClient = createSupabaseServiceRoleClient as ReturnType<typeof vi.fn>;
const mockAi = callAiText as ReturnType<typeof vi.fn>;

type RecipeRow = {
  id: string;
  title: string;
  image_url: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: string | null;
  cook_time_min: number | null;
};

/** Build a supabase client mock backing `saves` (by user) + `recipes` (by id). */
function buildClient(saved: RecipeRow[]) {
  const savedIds = saved.map((r) => r.id);
  function makeQuery(table: string) {
    const chain: any = {
      select: () => chain,
      eq: async () => {
        if (table === "saves") {
          return { data: savedIds.map((id) => ({ recipe_id: id })), error: null };
        }
        return { data: null, error: null };
      },
      in: async () => {
        if (table === "recipes") return { data: saved, error: null };
        return { data: null, error: null };
      },
    };
    return chain;
  }
  return { from: (table: string) => makeQuery(table) };
}

function recipeRow(over: Partial<RecipeRow> & { id: string }): RecipeRow {
  return {
    title: `Recipe ${over.id}`,
    image_url: null,
    calories: 500,
    protein: 30,
    carbs: 40,
    fat: 15,
    meal_type: null,
    cook_time_min: null,
    ...over,
  };
}

function coachRequest(body: unknown): Request {
  return new Request("http://localhost/api/nutrition/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const remaining = {
  calories: 1200,
  protein: 60,
  carbs: 120,
  fat: 40,
  dailyCalorieTarget: 2000,
};

describe("POST /api/nutrition/coach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserId.mockResolvedValue("user-1");
    mockCreateClient.mockReturnValue(
      buildClient([
        recipeRow({ id: "a", calories: 510 }),
        recipeRow({ id: "b", calories: 700 }),
        recipeRow({ id: "c", calories: 520 }),
      ]),
    );
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUserId.mockResolvedValue(null);
    const res = await POST(coachRequest({ remaining }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid remaining", async () => {
    const res = await POST(coachRequest({ remaining: { calories: "nope" } }));
    expect(res.status).toBe(400);
  });

  it("ranks candidates via the model and folds phrasing back (source=ai)", async () => {
    mockAi.mockResolvedValue({
      ok: true,
      text: JSON.stringify({
        rankedIds: ["c", "a"],
        reasons: { c: "Tops up your protein", a: "A lighter pick" },
      }),
    });
    const res = await POST(coachRequest({ remaining, slot: "dinner" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.source).toBe("ai");
    expect(json.candidates[0].recipeId).toBe("c");
    expect(json.candidates[0].whyLine).toBe("Tops up your protein");
    // Numbers stay OURS (one serving), not invented.
    expect(json.candidates[0].predictedCalories).toBe(520);
  });

  it("falls back to deterministic order when the provider errors (surface never empty)", async () => {
    mockAi.mockResolvedValue({
      ok: false,
      error: "ai_timeout",
      status: 504,
      message: "slow",
    });
    const res = await POST(coachRequest({ remaining, slot: "dinner" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe("deterministic");
    expect(json.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to deterministic order when the AI budget is exceeded", async () => {
    mockAi.mockRejectedValue(new AiBudgetExceededError("daily cap", 3600));
    const res = await POST(coachRequest({ remaining, slot: "dinner" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.source).toBe("deterministic");
    expect(json.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to deterministic order when the model returns junk", async () => {
    mockAi.mockResolvedValue({ ok: true, text: "not json at all" });
    const res = await POST(coachRequest({ remaining, slot: "dinner" }));
    const json = await res.json();
    expect(json.source).toBe("deterministic");
  });

  it("skips the AI call entirely when only one candidate fits", async () => {
    mockCreateClient.mockReturnValue(
      buildClient([recipeRow({ id: "solo", calories: 510 })]),
    );
    const res = await POST(coachRequest({ remaining, slot: "dinner" }));
    const json = await res.json();
    expect(json.source).toBe("deterministic");
    expect(json.candidates.length).toBe(1);
    expect(mockAi).not.toHaveBeenCalled();
  });

  it("returns empty candidates (no error) when no recipe fits the budget", async () => {
    const res = await POST(
      coachRequest({ remaining: { ...remaining, calories: 0 } }),
    );
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.candidates).toEqual([]);
    expect(mockAi).not.toHaveBeenCalled();
  });

  it("honours the kill switch — no AI call, deterministic order", async () => {
    const { isServerFeatureEnabled } = await import("@/lib/server/featureFlags");
    (isServerFeatureEnabled as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const res = await POST(coachRequest({ remaining, slot: "dinner" }));
    const json = await res.json();
    expect(json.source).toBe("deterministic");
    expect(mockAi).not.toHaveBeenCalled();
  });
});
