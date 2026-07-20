// @vitest-environment jsdom
/**
 * Web Cookbook-Import surface render test — ENG-1582 (web↔mobile parity).
 *
 * `CookbookImport` mirrors the mobile flow at `apps/mobile/app/cookbook-import.tsx`:
 * pick PDF → extract + parse → review (per-recipe exclude, author-vs-match) →
 * save to Library (partial-save on free tier). This test pins the user-observable
 * behaviour so the surface can't silently regress.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const { commitMock } = vi.hoisted(() => ({
  commitMock: vi.fn(),
}));
vi.mock("../../src/lib/planning/planImport/commitCookbookImport.ts", () => ({
  commitCookbookImport: commitMock,
  COOKBOOK_IMPORT_FREE_SAVE_CAP: 10,
}));

const supabaseFromMock = vi.fn();
vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: (...args: unknown[]) => supabaseFromMock(...args),
  },
}));

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => ({
    userId: "user-123",
    profileTier: "pro",
  }),
}));

import { CookbookImport } from "../../src/app/components/CookbookImport";
import { toast } from "sonner";

const toastMock = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};

const originalFetch = global.fetch;

const PARSED_RECIPES = [
  {
    key: "oats",
    title: "Overnight oats",
    serves: 1,
    ingredients: ["oats", "milk"],
    supprNutrition: { calories: 410, protein: 20, carbs: 55, fat: 12, fiberG: 8 },
    authorNutrition: { calories: 380, protein: 18, carbs: 52, fat: 10, fiberG: 7 },
    confidence: "high" as const,
    confidenceTier: "high" as const,
    ingredientCount: 2,
  },
  {
    key: "salad",
    title: "Green salad",
    serves: 2,
    ingredients: ["lettuce", "cucumber"],
    supprNutrition: { calories: 120, protein: 4, carbs: 10, fat: 6, fiberG: 3 },
    authorNutrition: null,
    confidence: "medium" as const,
    confidenceTier: "medium" as const,
    ingredientCount: 2,
  },
];

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.warning.mockClear();
  commitMock.mockReset();
  supabaseFromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null }),
      }),
    }),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchSequence(responses: Array<{ body: unknown; ok?: boolean; status?: number }>) {
  let i = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const r = responses[i++] ?? responses[responses.length - 1]!;
    return Promise.resolve({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: () => Promise.resolve(r.body),
    });
  }) as unknown as typeof fetch;
}

describe("CookbookImport — web Cookbook-Import surface (ENG-1582)", () => {
  it("renders the pick step (heading, PDF picker, book name, parse CTA)", () => {
    render(<CookbookImport onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /Import cookbook/i })).toBeInTheDocument();
    expect(screen.getByTestId("cookbook-import-pick-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("cookbook-import-book-name")).toBeInTheDocument();
    expect(screen.getByTestId("cookbook-import-parse")).toBeInTheDocument();
  });

  it("blocks parse without a PDF with an inline error", async () => {
    render(<CookbookImport onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("cookbook-import-parse"));
    expect(await screen.findByTestId("cookbook-import-error")).toHaveTextContent(
      /Choose a cookbook PDF first/i,
    );
    expect(global.fetch).toBe(originalFetch);
  });

  it("extracts + parses via cookbook-import routes and lands on review", async () => {
    mockFetchSequence([
      { body: { ok: true, text: "Recipe text…" } },
      { body: { ok: true, bookName: "Fast 800", recipes: PARSED_RECIPES } },
    ]);
    render(<CookbookImport onClose={vi.fn()} />);

    const file = new File(["pdf"], "fast-800.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("cookbook-import-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("cookbook-import-parse"));

    await waitFor(() => expect(screen.getByTestId("cookbook-import-review")).toBeInTheDocument());
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cookbook-import/extract",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/cookbook-import/parse",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(screen.getAllByText(/2 of 2 selected/i).length).toBeGreaterThanOrEqual(1);
  });

  it("toggles per-recipe exclude on review rows", async () => {
    mockFetchSequence([
      { body: { ok: true, text: "Recipe text…" } },
      { body: { ok: true, bookName: "Fast 800", recipes: PARSED_RECIPES } },
    ]);
    render(<CookbookImport onClose={vi.fn()} />);
    const file = new File(["pdf"], "fast-800.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("cookbook-import-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("cookbook-import-parse"));
    await waitFor(() => expect(screen.getByTestId("cookbook-import-review")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("cookbook-recipe-salad"));
    expect(screen.getAllByText(/1 of 2 selected/i).length).toBeGreaterThanOrEqual(1);
  });

  it("switches nutrition mode between author and match", async () => {
    mockFetchSequence([
      { body: { ok: true, text: "Recipe text…" } },
      { body: { ok: true, bookName: "Fast 800", recipes: PARSED_RECIPES } },
    ]);
    render(<CookbookImport onClose={vi.fn()} />);
    const file = new File(["pdf"], "fast-800.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("cookbook-import-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("cookbook-import-parse"));
    await waitFor(() => expect(screen.getByTestId("cookbook-import-review")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("cookbook-import-mode-author"));
    expect(screen.getByTestId("cookbook-recipe-oats")).toHaveTextContent("380 kcal");
    fireEvent.click(screen.getByTestId("cookbook-import-mode-match"));
    expect(screen.getByTestId("cookbook-recipe-oats")).toHaveTextContent("410 kcal");
  });

  it("commits via the shared pipeline and shows success", async () => {
    mockFetchSequence([
      { body: { ok: true, text: "Recipe text…" } },
      { body: { ok: true, bookName: "Fast 800", recipes: PARSED_RECIPES } },
    ]);
    commitMock.mockResolvedValue({
      ok: true,
      savedCount: 2,
      recipeIdByKey: { oats: "r1", salad: "r2" },
      stoppedEarly: false,
    });
    supabaseFromMock.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ count: 0 }),
      }),
    });

    render(<CookbookImport onClose={vi.fn()} />);
    const file = new File(["pdf"], "fast-800.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("cookbook-import-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("cookbook-import-parse"));
    await waitFor(() => expect(screen.getByTestId("cookbook-import-review")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("cookbook-import-save"));

    await waitFor(() => expect(screen.getByTestId("cookbook-import-success")).toBeInTheDocument());
    expect(commitMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-123",
        bookName: "Fast 800",
        nutritionMode: "match",
        recipes: expect.arrayContaining([
          expect.objectContaining({ key: "oats" }),
          expect.objectContaining({ key: "salad" }),
        ]),
      }),
      undefined,
    );
  });

  it("surfaces partial-save when the free-tier cap is hit mid-commit", async () => {
    mockFetchSequence([
      { body: { ok: true, text: "Recipe text…" } },
      { body: { ok: true, bookName: "Fast 800", recipes: PARSED_RECIPES } },
    ]);
    commitMock.mockResolvedValue({
      ok: true,
      savedCount: 1,
      recipeIdByKey: { oats: "r1" },
      stoppedEarly: true,
      stopReason: "save_limit",
    });
    supabaseFromMock.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ count: 0 }),
      }),
    });

    render(<CookbookImport onClose={vi.fn()} />);
    const file = new File(["pdf"], "fast-800.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("cookbook-import-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("cookbook-import-parse"));
    await waitFor(() => expect(screen.getByTestId("cookbook-import-review")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("cookbook-import-save"));

    await waitFor(() => expect(screen.getByTestId("cookbook-import-success")).toBeInTheDocument());
    expect(toastMock.warning).toHaveBeenCalledWith(
      "Partially saved",
      expect.objectContaining({
        description: expect.stringContaining("Saved 1 of 2 recipes"),
      }),
    );
    expect(screen.getByText(/before the free save limit/i)).toBeInTheDocument();
  });

  it("surfaces pro_required on parse with upgrade affordance", async () => {
    mockFetchSequence([
      { body: { ok: true, text: "Recipe text…" } },
      { body: { ok: false, error: "pro_required", message: "Pro required" }, ok: false, status: 403 },
    ]);
    const onUpgrade = vi.fn();
    render(<CookbookImport onClose={vi.fn()} onUpgrade={onUpgrade} />);
    const file = new File(["pdf"], "fast-800.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByTestId("cookbook-import-file-input"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("cookbook-import-parse"));

    expect(await screen.findByTestId("cookbook-import-error")).toHaveTextContent(/Pro/i);
    fireEvent.click(screen.getByTestId("cookbook-import-upgrade"));
    expect(onUpgrade).toHaveBeenCalled();
  });
});
