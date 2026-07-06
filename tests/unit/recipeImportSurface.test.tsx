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

// `SupprMark` (rendered on the "Paste a recipe link" card) reads the
// `design_system_brandmark` flag from this same module. Default it OFF so
// the legacy S-glyph (still a brand mark) renders; one test flips it on.
//
// `recipe-import-redesign` (ENG-898 web flag-gating parity with mobile) gates
// the NEW L4 amber error banner + the 3-method source tiles. Default it ON in
// this suite so the existing ENG-669/898 surface assertions keep exercising
// the new path; the dedicated flag-OFF tests below force it off to pin the
// legacy fallback (small destructive line + toast.error, no method tiles).
const { isFeatureEnabledSpy } = vi.hoisted(() => ({
  isFeatureEnabledSpy: vi.fn((flag: string) => flag === "recipe-import-redesign"),
}));
vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: isFeatureEnabledSpy,
}));

// `next/navigation` — RecipeUpload reads `?editRecipe=` from searchParams.
// Default to an empty param bag so the edit-load effect bails.
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Supabase browser client — auth.getSession (used on save) + a chained
// query builder (used by editRecipe load + ENG-898 recent imports).
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
          // ENG-1415 — saveRecipe now chains `.select("id")` after the
          // insert to correlate rows for an optional verify-RPC follow-up.
          insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
          select: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
          }),
        };
      }
      // recipes — upsert/single for save + recent-imports list (ENG-898)
      return {
        upsert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: "recipe-789", caffeine_mg: 0, alcohol_g: 0 },
                error: null,
              }),
          }),
        }),
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            not: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      {
                        title: "Sheet-Pan Fajitas",
                        source_name: "TikTok",
                        created_at: "2026-06-17T08:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
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
    userId: "user-123",
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
  // Reset to the suite default: only `recipe-import-redesign` ON. Tests that
  // need other flags (or the legacy OFF path) override per-case.
  isFeatureEnabledSpy.mockImplementation((flag: string) => flag === "recipe-import-redesign");
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

  it("renders the social/URL import entry points (paste a link + WORKS WITH trust row)", () => {
    render(<RecipeUpload userTier="free" mode="import" />);
    // ENG-898: non-tappable WORKS WITH monogram chips (mobile parity).
    expect(screen.getByTestId("import-works-with")).toBeInTheDocument();
    expect(screen.getByText("Works with")).toBeInTheDocument();
    expect(screen.getByLabelText("Works with TikTok")).toBeInTheDocument();
    expect(screen.getByLabelText("Works with Instagram")).toBeInTheDocument();
    expect(screen.getByLabelText("Works with YouTube")).toBeInTheDocument();
    expect(screen.getByLabelText("Works with Website")).toBeInTheDocument();
    // Paste-a-link card + URL input + Import button.
    expect(screen.getByText("Paste a recipe link")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import$/ })).toBeInTheDocument();
    // ENG-898 — 3-method source tiles (mobile parity).
    expect(screen.getByTestId("import-method-tiles")).toBeInTheDocument();
    expect(screen.getByTestId("import-method-photo")).toBeInTheDocument();
    expect(screen.getByTestId("import-method-paste-text")).toBeInTheDocument();
    expect(screen.getByTestId("import-method-scan")).toBeInTheDocument();
  });

  it("ENG-898 — renders recent imports when the user has URL-imported recipes", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-06-17T12:00:00.000Z"));
    try {
      render(<RecipeUpload userTier="free" mode="import" />);
      const section = await screen.findByTestId("import-recent-imports");
      expect(section).toHaveTextContent("Sheet-Pan Fajitas");
      expect(section).toHaveTextContent("Today");
      expect(section).toHaveTextContent("TT");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("leads the 'Paste a recipe link' card with the Sloe wordmark (mobile parity)", () => {
    render(<RecipeUpload userTier="free" mode="import" />);
    const heading = screen.getByText("Paste a recipe link");
    // Sloe DS slab radius (2026-06-07): the paste-link card moved from
    // `rounded-2xl` to the 24px Sloe slab `rounded-[var(--radius-card-lg)]`.
    // Match on the radius-card-lg class substring so the test tracks the
    // card regardless of the exact arbitrary-value class spelling.
    const card = heading.closest('div[class*="radius-card-lg"]');
    expect(card).not.toBeNull();
    const mark = card?.querySelector('[data-slot="sloe-mark"]');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute("aria-label", "Sloe");
    // 2026-06-04 wordmark→asset: the mark is a masked-SVG span (no literal
    // "sloe" text); verify it renders the canonical wordmark asset.
    expect(mark?.getAttribute("style")).toContain("sloe-wordmark.svg");
  });

  it("does not gate the import-card mark behind design_system_brandmark", () => {
    // brandmark OFF (redesign flag still resolves per default).
    isFeatureEnabledSpy.mockImplementation((flag: string) => flag === "recipe-import-redesign");
    render(<RecipeUpload userTier="free" mode="import" />);
    const card = screen.getByText("Paste a recipe link").closest('div[class*="radius-card-lg"]');
    expect(card?.querySelector('[data-slot="sloe-mark"]')).not.toBeNull();
    // brandmark ON (every flag ON) — the mark must still render.
    isFeatureEnabledSpy.mockReturnValue(true);
    render(<RecipeUpload userTier="free" mode="import" />);
    const cardOn = screen.getAllByText("Paste a recipe link")[1].closest('div[class*="radius-card-lg"]');
    expect(cardOn?.querySelector('[data-slot="sloe-mark"]')).not.toBeNull();
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

    const urlInput = screen.getByPlaceholderText("https://…");
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

  it("flag ON — surfaces L4 amber inline error (not toast-only) when the URL has no parseable recipe", async () => {
    // recipe-import-redesign ON (suite default): the L4 banner is the surface,
    // and the toast is suppressed so the error isn't shown twice.
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
    fireEvent.change(screen.getByPlaceholderText("https://…"), {
      target: { value: "https://example.com/not-a-recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));

    await waitFor(() => {
      expect(screen.getByTestId("import-l4-error")).toBeInTheDocument();
    });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText(/No Recipe JSON-LD found on this page/i),
    ).toBeInTheDocument();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("flag OFF — legacy error path: small destructive hint + toast.error, NO L4 banner (ENG-898 web flag-gating)", async () => {
    // recipe-import-redesign OFF (production until the flag ramps): restore the
    // pre-#483 behaviour — a toast plus the inline destructive line; the new
    // amber banner must NOT render.
    isFeatureEnabledSpy.mockImplementation(() => false);
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
    fireEvent.change(screen.getByPlaceholderText("https://…"), {
      target: { value: "https://example.com/not-a-recipe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));

    // Legacy: the toast fires with the server's actionable message.
    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(
        expect.stringMatching(/No Recipe JSON-LD found on this page/i),
      );
    });
    // The inline hint also renders as the small destructive line — but NOT the
    // new L4 amber banner.
    expect(
      screen.getByText(/No Recipe JSON-LD found on this page/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("import-l4-error")).not.toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("flag OFF — legacy idle surface does NOT render the 3-method source tiles", () => {
    // recipe-import-redesign OFF: the tile grid is part of the new design and
    // must be absent; the legacy photo affordance stays in the "Recipe photo"
    // card (asserted by the existing photo-import test).
    isFeatureEnabledSpy.mockImplementation(() => false);
    render(<RecipeUpload userTier="free" mode="import" />);
    expect(screen.queryByTestId("import-method-tiles")).not.toBeInTheDocument();
    expect(screen.queryByTestId("import-method-photo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("import-method-paste-text")).not.toBeInTheDocument();
    expect(screen.queryByTestId("import-method-scan")).not.toBeInTheDocument();
    // The legacy photo affordance is still present in the dedicated card.
    expect(screen.getByRole("button", { name: "Extract from image" })).toBeInTheDocument();
  });

  it("ENG-901 M6 — after save in import mode, renders ImportSuccessSheet (not a toast)", async () => {
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

    fireEvent.change(screen.getByPlaceholderText("https://…"), {
      target: { value: "https://example.com/fajitas" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Sheet-Pan Chicken Fajitas")).toBeInTheDocument();
    });

    toastMock.success.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Save to my library/i }));

    await waitFor(() => {
      expect(screen.getByTestId("import-success-sheet")).toBeInTheDocument();
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Sheet-Pan Chicken Fajitas")).toBeInTheDocument();
    expect(screen.getByText("In your library")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View recipe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review ingredients" })).toBeInTheDocument();
    // Import mode uses the success sheet — not the generic toast terminal.
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});

/**
 * ENG-1211 — each import method tile must DELIVER its method, not drop the user
 * on a generic create form. The "Paste text" / "Scan" tiles pass a method hint
 * to `onSwitchToCreate`; the create view auto-opens the matching affordance via
 * `createInitialMethod`. Web parity with mobile `?autoPaste=1` / `?autoBarcode=1`.
 */
describe("Import method tiles deliver their method (ENG-1211)", () => {
  it("Paste text tile passes the 'paste' hint to onSwitchToCreate", () => {
    const onSwitchToCreate = vi.fn();
    render(
      <RecipeUpload userTier="free" mode="import" onSwitchToCreate={onSwitchToCreate} />,
    );
    fireEvent.click(screen.getByTestId("import-method-paste-text"));
    expect(onSwitchToCreate).toHaveBeenCalledWith("paste");
  });

  it("Scan tile passes the 'scan' hint to onSwitchToCreate", () => {
    const onSwitchToCreate = vi.fn();
    render(
      <RecipeUpload userTier="free" mode="import" onSwitchToCreate={onSwitchToCreate} />,
    );
    fireEvent.click(screen.getByTestId("import-method-scan"));
    expect(onSwitchToCreate).toHaveBeenCalledWith("scan");
  });

  it("header 'Create instead' switch passes NO hint (plain create form)", () => {
    const onSwitchToCreate = vi.fn();
    render(
      <RecipeUpload userTier="free" mode="import" onSwitchToCreate={onSwitchToCreate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Create instead/i }));
    expect(onSwitchToCreate).toHaveBeenCalledWith();
    expect(onSwitchToCreate.mock.calls[0][0]).toBeUndefined();
  });

  it("createInitialMethod='paste' auto-opens the paste-ingredient-list dialog on mount", async () => {
    render(<RecipeUpload userTier="free" mode="create" createInitialMethod="paste" />);
    // The paste dialog is the create-view "paste text" affordance.
    expect(
      await screen.findByRole("heading", { name: /Paste ingredient list/i }),
    ).toBeInTheDocument();
  });

  it("createInitialMethod='scan' auto-opens the barcode scanner picker on mount", async () => {
    render(<RecipeUpload userTier="free" mode="create" createInitialMethod="scan" />);
    // The scan affordance is the per-ingredient swap picker with the barcode
    // section; it opens on the first (always-present) ingredient row.
    expect(await screen.findByText(/Barcode \(Open Food Facts\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Scan with camera/i })).toBeInTheDocument();
  });

  it("create mode with NO method hint does not auto-open any affordance", () => {
    render(<RecipeUpload userTier="free" mode="create" />);
    expect(screen.queryByRole("heading", { name: /Paste ingredient list/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Barcode \(Open Food Facts\)/i)).not.toBeInTheDocument();
  });
});
