import { describe, it, expect, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === "x-forwarded-for" ? "127.0.0.1" : null),
  }),
}));

// Mock auth to return a valid user for non-auth tests
vi.mock("@/lib/supabase/serverAnonClient", () => ({
  getUserIdFromRequest: async () => "test-user-id",
  getUserIdFromAuthHeader: async () => "test-user-id",
  createSupabaseAnonClient: () => ({}),
  supabasePublicUrl: () => "https://example.supabase.co",
}));

// Keep verify path on estimation fallback (no live USDA/OFF/FatSecret in CI)
vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: vi.fn(async () => []),
}));

vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => false,
  hasFatSecretConfig: () => false,
  hasEdamamConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

import type { VerifyResult } from "@/lib/nutrition/verifyIngredients";
import { POST } from "../../app/api/nutrition/verify-recipe/route";
import { assertVerifyResultShape, expectPerServingMatchesTotals } from "../fixtures/verifyRecipeGolden";

describe("POST /api/nutrition/verify-recipe", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/nutrition/verify-recipe", {
        method: "POST",
        body: "not-json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when ingredients empty", async () => {
    const res = await POST(
      new Request("http://localhost/api/nutrition/verify-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: [], servings: 1 }),
      }),
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error?: string };
    expect(j.error).toBe("no_ingredients");
  });

  it("returns 200 with stable verify shape (golden estimation path)", async () => {
    // Both ingredients are absent from the curated genericFoods/genericBeverages
    // tables (ENG-746) so they hit the estimation fallback, keeping this an
    // all-Estimated golden path. A curated staple (e.g. "chicken breast") would
    // now short-circuit to a "Suppr" match and flip primarySource.
    const body = {
      ingredients: [
        { name: "olive oil", amount: "2", unit: "tbsp" },
        { name: "sirloin steak", amount: "200", unit: "g" },
      ],
      servings: 2,
      provider: "auto" as const,
    };
    const res = await POST(
      new Request("http://localhost/api/nutrition/verify-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean } & VerifyResult;
    expect(j.ok).toBe(true);
    const { ok: _ok, ...rest } = j;
    assertVerifyResultShape(rest);
    expect(rest.primarySource).toBe("Estimated");
    expectPerServingMatchesTotals(rest, body.servings);
  });
});
