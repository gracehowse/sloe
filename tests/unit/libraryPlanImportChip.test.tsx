// @vitest-environment jsdom
/**
 * Library "Imported plans" chip — ENG-653 (web↔mobile parity).
 *
 * The mobile Library reveals contextual plan-import source pills when the
 * Imported entry-kind is active (`apps/mobile/app/(tabs)/library.tsx`). The
 * web Library now mirrors that: when the user cycles the entry-kind to
 * Imported and they have plan-import recipes, a pill row appears that filters
 * the grid to a single imported plan. This test pins:
 *
 *   1. The pills are HIDDEN by default (single filter row when not in Imported).
 *   2. Cycling to Imported reveals one pill per distinct imported plan.
 *   3. Tapping a plan pill narrows the count line to that plan's recipes.
 *
 * The shared predicate logic is pinned separately in
 * `tests/unit/planImportLibraryFilters.test.ts`.
 */
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PLAN_IMPORT_SOURCE_PREFIX } from "../../src/lib/planning/planImport/types.ts";

void React;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../src/lib/analytics/track.ts", () => ({ track: vi.fn(), isFeatureEnabled: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("../../src/lib/libraryDiscoverSearchStore.ts", () => ({
  useLibraryDiscoverSearch: () => ({ query: "", setQuery: vi.fn() }),
}));
vi.mock("../../src/app/components/RecipeDetail", () => ({ RecipeDetail: () => <div /> }));

const RECIPES = [
  {
    id: "r1",
    title: "Week 1 oats",
    calories: 400,
    protein: 20,
    carbs: 50,
    fat: 10,
    isSaved: true,
    authorId: "user-123",
    sourceName: `${PLAN_IMPORT_SOURCE_PREFIX}Fast 800`,
  },
  {
    id: "r2",
    title: "Week 1 curry",
    calories: 600,
    protein: 35,
    carbs: 40,
    fat: 22,
    isSaved: true,
    authorId: "user-123",
    sourceName: `${PLAN_IMPORT_SOURCE_PREFIX}Fast 800`,
  },
  {
    id: "r3",
    title: "Bulk shake",
    calories: 500,
    protein: 40,
    carbs: 45,
    fat: 12,
    isSaved: true,
    authorId: "user-123",
    sourceName: `${PLAN_IMPORT_SOURCE_PREFIX}Bulk block`,
  },
];

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => ({
    savedRecipesForLibrary: RECIPES,
    libraryEntryKindByRecipeId: { r1: "imported", r2: "imported", r3: "imported" },
    userId: "user-123",
    duplicateRecipeToCreatedDraft: vi.fn(),
    toggleSaveRecipe: vi.fn(),
    nutritionTargets: { calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 30, waterMl: 2000 },
  }),
}));

import { Library } from "../../src/app/components/Library";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Library — Imported plans chip (ENG-653)", () => {
  it("hides the plan-import pills until Imported is active", () => {
    render(<Library userTier="free" />);
    expect(screen.queryByTestId("library-plan-import-pills")).not.toBeInTheDocument();
  });

  it("reveals one pill per distinct imported plan when Imported is active", () => {
    render(<Library userTier="free" />);
    // ENG-1247: the provenance row replaces the cycle — tap Imported directly.
    fireEvent.click(screen.getByTestId("library-provenance-imported"));

    const pills = screen.getByTestId("library-plan-import-pills");
    const buttons = within(pills).getAllByRole("button");
    // Two distinct plans → two pills, short labels (prefix stripped).
    expect(buttons).toHaveLength(2);
    expect(within(pills).getByText("Fast 800")).toBeInTheDocument();
    expect(within(pills).getByText("Bulk block")).toBeInTheDocument();
  });

  it("narrows the grid to one plan when its pill is tapped", () => {
    render(<Library userTier="free" />);
    // ENG-1247: tap the provenance Imported chip directly (cycle is gone).
    fireEvent.click(screen.getByTestId("library-provenance-imported"));

    // All three imported recipes before refining.
    expect(screen.getByTestId("library-count-line")).toHaveTextContent("3");

    fireEvent.click(screen.getByText("Bulk block"));
    // Only the single Bulk-block recipe remains.
    expect(screen.getByTestId("library-count-line")).toHaveTextContent("1");
  });
});
