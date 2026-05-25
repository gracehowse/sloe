/**
 * @vitest-environment node
 *
 * Integration tests for POST /api/plan-import/parse — auth, validation,
 * LLM parse (mocked), verifyIngredients (mocked). No live AI or nutrition APIs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: vi.fn(),
}));

vi.mock("@/lib/server/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/server/featureFlags", () => ({
  isServerFeatureEnabled: vi.fn(async () => false),
}));

vi.mock("@/lib/server/aiProvider", () => ({
  callAiText: vi.fn(),
  AiBudgetExceededError: class AiBudgetExceededError extends Error {
    retryAfterSec = 3600;
  },
}));

vi.mock("@/lib/nutrition/verifyIngredients", () => ({
  verifyIngredients: vi.fn(async () => ({
    avgIngredientConfidence: 0.82,
    perServing: { calories: 420, protein: 32, carbs: 18, fat: 14, fiberG: 4 },
    verified: [],
  })),
}));

import { POST } from "../../app/api/plan-import/parse/route";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { callAiText } from "@/lib/server/aiProvider";
import { MEAL_PREP_WEEK1_PARSED } from "@/lib/planning/planImport/fixtures/mealPrepWeek1";

const mockUserId = getUserIdFromRequest as ReturnType<typeof vi.fn>;
const mockCallAiText = callAiText as ReturnType<typeof vi.fn>;

function req(body: unknown): Request {
  return new Request("http://localhost/api/plan-import/parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/plan-import/parse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCallAiText.mockResolvedValue({
      ok: true,
      text: JSON.stringify(MEAL_PREP_WEEK1_PARSED),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when unauthenticated", async () => {
    mockUserId.mockResolvedValue(null);
    const res = await POST(req({ text: "Mon Lunch: bowl" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
  });

  it("returns 400 for missing text", async () => {
    mockUserId.mockResolvedValue("u1");
    const res = await POST(req({ text: "   " }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("missing_text");
  });

  it("returns 422 when model finds no recipes or schedule", async () => {
    mockUserId.mockResolvedValue("u1");
    mockCallAiText.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ planName: "Empty", recipes: [], schedule: [] }),
    });
    const res = await POST(req({ text: "Mon Lunch: mystery dish only" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("no_content_parsed");
  });

  it("returns compiled plan on happy path", async () => {
    mockUserId.mockResolvedValue("u1");
    const res = await POST(
      req({ text: "Meal prep week 1 with recipes", planName: "Custom name" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.planName).toBe("Custom name");
    expect(json.recipes).toHaveLength(MEAL_PREP_WEEK1_PARSED.recipes.length);
    expect(json.slots.length).toBeGreaterThan(0);
    expect(json.stats.recipeCount).toBe(MEAL_PREP_WEEK1_PARSED.recipes.length);
    expect(mockCallAiText).toHaveBeenCalledOnce();
  });
});
