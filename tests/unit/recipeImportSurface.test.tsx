// @vitest-environment jsdom
/**
 * /import surface render test — ENG-669 (launch-blocker regression guard).
 *
 * `/import` is the canonical web recipe-import path and the viral launch
 * hook (paste a TikTok/Instagram/YouTube/blog link or a photo → parse →
 * review → save to Library). It once rendered a BLANK WHITE PAGE because
 * the App-shell path→view map didn't include the `import` segment, so the
 * URL never switched the view to the (already-built) import UI.
 *
 * This test renders the component the `/import` route mounts —
 * `<RecipeUpload mode="import" />` — and pins the import UI so the surface
 * can never silently regress to blank again:
 *   1. The import entry points render (NOT null): the "Import from" source
 *      grid (TikTok / Instagram / YouTube / Website), the "Paste a recipe
 *      link" URL field, and the photo "Extract from image" affordance.
 *   2. Pasting a link → "Import" calls the existing `/api/recipe-import`
 *      route and populates the review form from the parsed recipe.
 *   3. After a parse, the user can save the reviewed recipe to their
 *      Library (the import flow's terminal action).
 *
 * The route wiring itself (path→view map + `case "import"` render) is
 * pinned separately in `tests/unit/webRouteCompletion.test.ts`.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

// recharts pulls a ResizeObserver + canvas it doesn't get in jsdom; the
// MacroWheel is decorative, so stub the primitives to inert spans.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <span />,
}));

// Mock factories are hoisted above top-level declarations, so the mock
// state lives inside each factory and is reached after import via
// `vi.mocked(...)`.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
}));

// `next/navigation` — RecipeUpload reads `?editRecipe=` from searchParams.
// Default to an empty param bag so the edit-load effect bails.
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

// Supabase browser client — auth.getSession (used on save) + a chained
// query builder (used by editRecipe load, which we don't trigger here).
vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-123" } } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === "recipe_ingredients") {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: () => Promise.resolve({ error: null }),
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
          }),
        };
      }
      // recipes
      return {
        upsert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: "recipe-789" }, error: null }) }),
        }),
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      };
    },
  },
}));

vi.mock("../../src/lib/supabase/uploadRecipeImage.ts", () => ({
  uploadRecipeImage: vi.fn().mockResolvedValue({ ok: true, publicUrl: "https://cdn.test/img.jpg" }),
}));

// AppDataContext — RecipeUpload only destructures four members.
vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => ({
    refreshDiscoverRecipes: vi.fn().mockResolvedValue(undefined),
    refreshMyLibraryRecipes: vi.fn().mockResolvedValue(undefined),
    ensureRecipeInLibraryWithKind: vi.fn(),
    nutritionTargets: { calories: 2000, protein: 150, carbs: 200, fat: 60, fiber: 30, waterMl: 2000 },
  }),
}));

import { RecipeUpload } from "../../src/app/components/RecipeUpload";
import { toast } from "sonner";
import { track } from "../../src/lib/analytics/track.ts";

const toastMock = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};
const trackMock = track as unknown as ReturnType<typeof vi.fn>;

const originalFetch = global.fetch;

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.warning.mockClear();
  trackMock.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("/import surface — RecipeUpload mode=\"import\" (ENG-669)", () => {
  it("renders the import UI (not a blank page): heading + intent copy", () => {
    render(<RecipeUpload userTier="free" mode="import" />);
    // The header that proves we're on the import surface, not null.
    expect(screen.getByRole("heading", { level: 1, name: /Import recipe/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Bring in recipes you have access to/i),
    ).toBeInTheDocument();
  });

  it("renders the social/URL import entry points (paste a link)", () => {
    render(<RecipeUpload userTier="free" mode="import" />);
    // "Import from" 2x2 source grid — the viral hook surfaces.
    expect(screen.getByText("Import from")).toBeInTheDocument();
    expect(screen.getByText("TikTok")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByText("Website")).toBeInTheDocument();
    // Paste-a-link card + URL input + Import button.
    expect(screen.getByText("Paste a recipe link")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://example.com/recipe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import$/ })).toBeInTheDocument();
  });

  it("renders the photo import affordance (extract from image)", () => {
    render(<RecipeUpload userTier="free" mode="import" />);
    expect(screen.getByText(/Recipe photo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extract from image" })).toBeInTheDocument();
  });

  it("does NOT offer publish controls in import mode (library-only copies)", () => {
    render(<RecipeUpload userTier="pro" mode="import" />);
    // Import mode saves to the private library; it never publishes
    // someone else's content. The GoPublicDialog "Ready to share?" block
    // is create-mode-only.
    expect(screen.queryByText(/Ready to share\?/i)).not.toBeInTheDocument();
  });

  it("pastes a link, calls /api/recipe-import, and populates the review form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<RecipeUpload userTier="free" mode="import" />);

    const urlInput = screen.getByPlaceholderText("https://example.com/recipe");
    fireEvent.change(urlInput, { target: { value: "https://example.com/fajitas" } });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));

    // It must hit the EXISTING import API route — not reinvent parsing.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/recipe-import",
        expect.objectContaining({ method: "POST" }),
      );
    });

    // The parsed recipe lands in the review form (title field).
    await waitFor(() => {
      expect(screen.getByDisplayValue("Sheet-Pan Chicken Fajitas")).toBeInTheDocument();
    });
    // The consolidated import analytics event fires with source=url.
    expect(trackMock).toHaveBeenCalledWith(
      "recipe_imported",
      expect.objectContaining({ source: "url" }),
    );
  });

  it("surfaces a calm hint (not a crash) when the URL has no parseable recipe", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        error: "no_recipe_schema",
        message: "No Recipe JSON-LD found on this page. Paste ingredients and steps manually, or try another URL.",
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<RecipeUpload userTier="free" mode="import" />);
    fireEvent.change(screen.getByPlaceholderText("https://example.com/recipe"), {
      target: { value: "https://example.com/not-a-recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        "No Recipe JSON-LD found on this page. Paste ingredients and steps manually, or try another URL.",
      );
    });
    // The inline hint renders so the user has a recovery path.
    expect(
      screen.getByText(/No Recipe JSON-LD found on this page/i),
    ).toBeInTheDocument();
  });
});
