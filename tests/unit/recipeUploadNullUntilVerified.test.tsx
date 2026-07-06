// @vitest-environment jsdom
/**
 * ENG-1415 (2026-07-06 nutrition-trust persistence pass) — RecipeUpload's
 * `saveRecipe` must never persist `estimateLineMacros`'s raw estimator sum
 * as the recipe's authoritative nutrition. Before this fix, whenever verify
 * hadn't resolved (in flight, failed, or — before the same session's
 * un-gating fix — simply unavailable to free-tier users), the confidently
 * wrong estimator sum landed in `recipes.calories` etc. and rendered
 * everywhere with full authority. The fix: persist `null` (an existing,
 * already-understood "not yet computed" state) instead.
 *
 * This test drives the same "paste a URL → import → Save" path proven in
 * `recipeImportSurface.test.tsx`, but captures the actual `recipes` upsert
 * payload to assert on the persisted macro values directly. The mocked
 * `/api/recipe-import` response shape doesn't match `/api/nutrition/verify-recipe`'s
 * contract, so even if the auto-verify debounce fires during the test's
 * `waitFor` window, verify safely no-ops (shape mismatch → caught, ignored)
 * and `verifiedOk` stays false — exactly the scenario under test.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <span />,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => true),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { upsertPayloads, rpcCalls } = vi.hoisted(() => ({
  upsertPayloads: [] as Record<string, unknown>[],
  rpcCalls: [] as { fn: string; args: unknown }[],
}));

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-123" } } },
        error: null,
      }),
    },
    rpc: vi.fn((fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ error: null });
    }),
    from: (table: string) => {
      if (table === "recipe_ingredients") {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: () => ({ select: () => Promise.resolve({ data: [{ id: "ing-1" }], error: null }) }),
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
          }),
        };
      }
      return {
        upsert: (payload: Record<string, unknown>) => {
          upsertPayloads.push(payload);
          return {
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "recipe-789", caffeine_mg: 0, alcohol_g: 0 },
                  error: null,
                }),
            }),
          };
        },
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            not: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
          }),
        }),
      };
    },
  },
}));

vi.mock("../../src/lib/supabase/uploadRecipeImage.ts", () => ({
  uploadRecipeImage: vi.fn().mockResolvedValue({ ok: true, publicUrl: "https://cdn.test/img.jpg" }),
}));

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => ({
    userId: "user-123",
    refreshDiscoverRecipes: vi.fn().mockResolvedValue(undefined),
    refreshMyLibraryRecipes: vi.fn().mockResolvedValue(undefined),
    ensureRecipeInLibraryWithKind: vi.fn(),
    nutritionTargets: { calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 30, waterMl: 2000 },
  }),
}));

import { RecipeUpload } from "../../src/app/components/RecipeUpload";

describe("ENG-1415 — saveRecipe persists null (not the raw estimator sum) when verify hasn't resolved", () => {
  // Component-mount + multiple waitFor cycles run slower under the full
  // suite's CPU load than in isolation (~3s here vs. the 5s vitest default);
  // explicit timeout avoids a false-negative flake, not masking a real issue.
  it("free-tier user, import save with verify unresolved: recipes.calories/protein/carbs/fat/fiber_g/sugar_g/sodium_mg are all null", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        recipe: {
          title: "Sheet-Pan Chicken Fajitas",
          description: "Weeknight fajitas",
          ingredients: ["2 chicken breasts", "1 bell pepper", "1 onion"],
          instructions: ["Slice everything", "Roast 20 min"],
          servings: 4,
          prepTimeMin: 10,
          cookTimeMin: 20,
          imageUrl: "https://cdn.test/fajitas.jpg",
          sourceUrl: "https://example.com/fajitas",
          sourceName: "Example Kitchen",
        },
      }),
    }) as unknown as typeof fetch;

    render(<RecipeUpload userTier="free" mode="import" />);

    fireEvent.change(screen.getByPlaceholderText("https://…"), {
      target: { value: "https://example.com/fajitas" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sheet-Pan Chicken Fajitas")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Save to my library/i }));

    await waitFor(() => {
      expect(upsertPayloads.length).toBeGreaterThan(0);
    });

    const payload = upsertPayloads[0]!;
    expect(payload.calories).toBeNull();
    expect(payload.protein).toBeNull();
    expect(payload.carbs).toBeNull();
    expect(payload.fat).toBeNull();
    expect(payload.fiber_g).toBeNull();
    expect(payload.sugar_g).toBeNull();
    expect(payload.sodium_mg).toBeNull();

    // No verified totals resolved -> the RPC follow-up must never fire.
    expect(rpcCalls.length).toBe(0);
  }, 15_000);
});
