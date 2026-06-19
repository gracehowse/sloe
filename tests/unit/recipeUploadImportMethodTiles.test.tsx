// @vitest-environment jsdom
/**
 * /import 3-method source tiles — ENG-898 web flag-gating parity (web ↔ mobile).
 *
 * PR #483 shipped the WEB import redesign (the L4 amber error banner + the
 * Photo / Paste text / Scan tile grid) UNGATED, while the identical MOBILE
 * change is correctly gated behind `recipe-import-redesign`. That violated the
 * "visual/structural changes ship behind a feature flag, old path alive in the
 * else" non-negotiable and lit web while mobile stayed dark.
 *
 * This suite pins the WEB gate so it can't silently regress to ungated:
 *   • flag ON  → the 3-method tile grid renders, with the Photo tile Pro-gated
 *                (free → onUpgrade; pro → opens the hidden file input), and
 *                Paste text / Scan routing via `onSwitchToCreate`.
 *   • flag OFF → no tile grid at all (production fallback until the flag ramps);
 *                the legacy photo affordance ("Recipe photo" card) is unaffected.
 *
 * The error-banner half of the same flag is covered behaviourally in
 * `recipeImportSurface.test.tsx`.
 *
 * Mirror of the mobile gate at `apps/mobile/app/import-shared.tsx` (same flag
 * name; NOT in REDESIGN_DEFAULT_ON → OFF in production).
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

void React;

// recharts is decorative here — stub to inert nodes (no ResizeObserver/canvas).
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => <span />,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// `recipe-import-redesign` ON by default in this suite; the flag-OFF case forces
// it off. (`design_system_brandmark` stays OFF — only the import flag matters.)
const { isFeatureEnabledSpy } = vi.hoisted(() => ({
  isFeatureEnabledSpy: vi.fn((flag: string) => flag === "recipe-import-redesign"),
}));
vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: isFeatureEnabledSpy,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-123" } } },
        error: null,
      }),
    },
    from: () => ({
      upsert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: { id: "recipe-789" }, error: null }) }),
      }),
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          not: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
          }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
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

beforeEach(() => {
  isFeatureEnabledSpy.mockImplementation((flag: string) => flag === "recipe-import-redesign");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("/import 3-method source tiles — recipe-import-redesign gate (ENG-898)", () => {
  describe("flag ON (recipe-import-redesign)", () => {
    it("renders all three method tiles in the paste-link card", () => {
      render(<RecipeUpload userTier="pro" mode="import" />);
      expect(screen.getByTestId("import-method-tiles")).toBeInTheDocument();
      const photo = screen.getByTestId("import-method-photo");
      const pasteText = screen.getByTestId("import-method-paste-text");
      const scan = screen.getByTestId("import-method-scan");
      expect(photo).toBeInTheDocument();
      expect(pasteText).toBeInTheDocument();
      expect(scan).toBeInTheDocument();
      // Tile labels (mobile parity copy).
      expect(photo).toHaveTextContent("Photo");
      expect(pasteText).toHaveTextContent("Paste text");
      expect(scan).toHaveTextContent("Scan");
    });

    it("free tier — Photo tile is Pro-gated: label flags upgrade and press calls onUpgrade (no file picker)", () => {
      const onUpgrade = vi.fn();
      render(<RecipeUpload userTier="free" mode="import" onUpgrade={onUpgrade} />);
      const photo = screen.getByTestId("import-method-photo");
      expect(photo).toHaveAttribute(
        "aria-label",
        "Import from a photo — Pro feature, upgrade required",
      );
      expect(photo).toHaveTextContent("Pro · Snap a recipe");
      fireEvent.click(photo);
      expect(onUpgrade).toHaveBeenCalledTimes(1);
    });

    it("pro tier — Photo tile is not gated and clicking it opens the hidden file input", () => {
      const onUpgrade = vi.fn();
      render(<RecipeUpload userTier="pro" mode="import" onUpgrade={onUpgrade} />);
      const photo = screen.getByTestId("import-method-photo");
      expect(photo).toHaveAttribute("aria-label", "Import from a photo");
      expect(photo).toHaveTextContent("Snap a recipe");
      // The hidden file input is the click target; spy on it so we can assert
      // the press opens the native picker rather than upgrading.
      const fileInput = document.querySelector(
        'input[type="file"][aria-label="Choose recipe photos to import"]',
      ) as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();
      const clickSpy = vi.spyOn(fileInput!, "click").mockImplementation(() => {});
      fireEvent.click(photo);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(onUpgrade).not.toHaveBeenCalled();
    });

    it("Paste text and Scan tiles route to the create surface via onSwitchToCreate", () => {
      const onSwitchToCreate = vi.fn();
      render(
        <RecipeUpload userTier="pro" mode="import" onSwitchToCreate={onSwitchToCreate} />,
      );
      fireEvent.click(screen.getByTestId("import-method-paste-text"));
      fireEvent.click(screen.getByTestId("import-method-scan"));
      // PARITY NOTE (web ↔ mobile gap): on mobile these route to two distinct
      // destinations (`/recipe/create` vs `/create-recipe`); on web both call
      // `onSwitchToCreate`. Asserted here so the web behaviour is pinned and the
      // gap is visible; closing it is tracked separately.
      expect(onSwitchToCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe("flag OFF (legacy, production until ramp)", () => {
    beforeEach(() => {
      isFeatureEnabledSpy.mockImplementation(() => false);
    });

    it("does NOT render the 3-method tile grid", () => {
      render(<RecipeUpload userTier="pro" mode="import" />);
      expect(screen.queryByTestId("import-method-tiles")).not.toBeInTheDocument();
      expect(screen.queryByTestId("import-method-photo")).not.toBeInTheDocument();
      expect(screen.queryByTestId("import-method-paste-text")).not.toBeInTheDocument();
      expect(screen.queryByTestId("import-method-scan")).not.toBeInTheDocument();
    });

    it("keeps the legacy photo affordance (the 'Recipe photo' card) intact", () => {
      render(<RecipeUpload userTier="pro" mode="import" />);
      // The dedicated photo card is outside the redesign gate, so it survives.
      expect(screen.getByText(/Recipe photo/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Extract from image" })).toBeInTheDocument();
    });

    it("the paste-a-link URL field + Import button still render (core import path is flag-independent)", () => {
      render(<RecipeUpload userTier="pro" mode="import" />);
      expect(screen.getByPlaceholderText("https://…")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Import$/ })).toBeInTheDocument();
    });
  });
});
