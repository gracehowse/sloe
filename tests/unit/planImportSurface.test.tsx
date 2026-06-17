// @vitest-environment jsdom
/**
 * Web Plan-Import surface render test — ENG-696 (web↔mobile parity).
 *
 * `PlanImport` mirrors the mobile flow at `apps/mobile/app/plan-import.tsx`:
 * paste → parse → review (editable rows + dual-kcal trust display) →
 * assessment (avg vs target) → commit (template only / activate). This test
 * pins the user-observable behaviour so the surface can't silently regress:
 *
 *   1. The paste step renders (heading, paste field, plan-name field, parse CTA).
 *   2. Parse → calls the SAME `/api/plan-import/parse` route the mobile flow uses
 *      and lands on the review step with the assessment panel (avg vs target).
 *   3. The review rows show the dual-kcal trust line (author vs Sloe calc).
 *   4. A parse failure surfaces an inline error and keeps the user on paste.
 *   5. Commit calls the SHARED `commitPlanImport` pipeline and fires the
 *      `plan_template_created` analytics event with `source: "plan_import"`.
 *
 * The route wiring (path→view map + `case "plan-import"`) is pinned in
 * `tests/unit/webRouteCompletion.test.ts`.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

void React;

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => true),
}));

// Shared commit pipeline — mock so we don't hit Supabase; assert it's called
// with the reviewed slots/recipes (proves the surface reuses the pipeline).
const { commitMock } = vi.hoisted(() => ({
  commitMock: vi.fn(),
}));
vi.mock("../../src/lib/planning/planImport/commitPlanImport.ts", () => ({
  commitPlanImport: commitMock,
}));

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {},
}));

const setMealPlanMock = vi.fn();
vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => ({
    userId: "user-123",
    nutritionTargets: { calories: 2100, protein: 160, carbs: 210, fat: 60, fiber: 30, waterMl: 2000 },
    setMealPlan: setMealPlanMock,
  }),
}));

import { PlanImport } from "../../src/app/components/PlanImport";
import { toast } from "sonner";
import { track } from "../../src/lib/analytics/track.ts";

const toastMock = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};
const trackMock = track as unknown as ReturnType<typeof vi.fn>;

const originalFetch = global.fetch;

const PARSE_OK = {
  ok: true,
  planName: "Coach plan",
  recipes: [
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
  ],
  slots: [
    {
      dayIndex: 0,
      dayLabel: "Mon",
      slot: "Breakfast",
      title: "Overnight oats",
      recipeKeys: ["oats"],
      linkStatus: "linked" as const,
      portionMultiplier: 1,
      supprNutrition: { calories: 410, protein: 20, carbs: 55, fat: 12, fiberG: 8 },
      authorNutrition: { calories: 380, protein: 18, carbs: 52, fat: 10, fiberG: 7 },
      claimedKcal: 380,
      confidence: "high" as const,
    },
  ],
  stats: { recipeCount: 1, slotCount: 1, linkedCount: 1, blockedCount: 0, avgKcalPerDay: 410 },
};

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  trackMock.mockClear();
  commitMock.mockReset();
  setMealPlanMock.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

describe("PlanImport — web Plan-Import surface (ENG-696)", () => {
  it("renders the paste step (heading, paste field, plan name, parse CTA)", () => {
    render(<PlanImport onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: /Import meal plan/i })).toBeInTheDocument();
    expect(screen.getByTestId("plan-import-paste-field")).toBeInTheDocument();
    expect(screen.getByTestId("plan-import-name-paste")).toBeInTheDocument();
    expect(screen.getByTestId("plan-import-parse")).toBeInTheDocument();
  });

  it("blocks parse on empty paste with an inline error", async () => {
    render(<PlanImport onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId("plan-import-paste-field"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("plan-import-parse"));
    expect(await screen.findByTestId("plan-import-error")).toHaveTextContent(/Paste your weekly plan/i);
    expect(global.fetch).toBe(originalFetch); // never called the route
  });

  it("parses via /api/plan-import/parse and lands on review with the assessment panel", async () => {
    mockFetchOnce(PARSE_OK);
    render(<PlanImport onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId("plan-import-paste-field"), {
      target: { value: "Mon Breakfast: Overnight oats" },
    });
    fireEvent.click(screen.getByTestId("plan-import-parse"));

    await waitFor(() => expect(screen.getByTestId("plan-import-review")).toBeInTheDocument());
    // SAME route the mobile flow calls.
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/plan-import/parse",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    // Turn OFF auto-rebalance so the assessment shows the raw parsed average
    // (rebalance scales single-slot days toward the target — a separate,
    // pinned behaviour in planImportRebalance.test.ts).
    fireEvent.click(screen.getByTestId("plan-import-rebalance"));
    // Assessment panel: avg vs the user's real target (2100).
    const panel = screen.getByTestId("plan-import-assessment");
    expect(panel).toHaveTextContent(/410 kcal\/day/);
    expect(panel).toHaveTextContent(/2100/);
    expect(panel).toHaveTextContent(/1 recipes · 1 slots · 0 blocked/);
  });

  it("shows the dual-kcal trust line on review rows (Sloe vs author)", async () => {
    mockFetchOnce(PARSE_OK);
    render(<PlanImport onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId("plan-import-paste-field"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("plan-import-parse"));
    await waitFor(() => expect(screen.getByTestId("plan-import-review")).toBeInTheDocument());
    // Turn OFF auto-rebalance so the row shows the raw parsed kcal (rebalance
    // would scale the single-slot day toward the target).
    fireEvent.click(screen.getByTestId("plan-import-rebalance"));

    const row = screen.getByTestId("plan-import-slot-row");
    // Default mode = match → primary number is the Sloe calc (410), trust line
    // surfaces the author figure (380).
    expect(row).toHaveTextContent("410");
    expect(row).toHaveTextContent(/author 380/);

    // Switch to author's-numbers → primary flips to 380, trust line shows Sloe.
    fireEvent.click(screen.getByTestId("plan-import-mode-author"));
    const rowAfter = screen.getByTestId("plan-import-slot-row");
    expect(rowAfter).toHaveTextContent("380");
    expect(rowAfter).toHaveTextContent(/Sloe 410/);
  });

  it("surfaces a parse failure inline and stays on the paste step", async () => {
    mockFetchOnce({ ok: false, message: "Could not parse that plan." }, false, 422);
    render(<PlanImport onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId("plan-import-paste-field"), { target: { value: "garbage" } });
    fireEvent.click(screen.getByTestId("plan-import-parse"));

    expect(await screen.findByTestId("plan-import-error")).toHaveTextContent(/Could not parse that plan/i);
    expect(screen.getByTestId("plan-import-paste")).toBeInTheDocument(); // still on paste
  });

  it("commits via the shared pipeline and fires plan_template_created (activate)", async () => {
    mockFetchOnce(PARSE_OK);
    commitMock.mockResolvedValue({
      ok: true,
      templateId: "tmpl-1",
      recipeIdByKey: { oats: "r1" },
      dayPlan: [{ day: 0, meals: [] }],
    });
    const onClose = vi.fn();
    render(<PlanImport onClose={onClose} />);
    fireEvent.change(screen.getByTestId("plan-import-paste-field"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("plan-import-parse"));
    await waitFor(() => expect(screen.getByTestId("plan-import-review")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("plan-import-save"));
    fireEvent.click(await screen.findByTestId("plan-import-activate"));

    await waitFor(() => expect(commitMock).toHaveBeenCalledTimes(1));
    expect(commitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        importToLibrary: true,
        nutritionMode: "match",
        slots: expect.any(Array),
        recipes: expect.any(Array),
      }),
    );
    expect(trackMock).toHaveBeenCalledWith(
      "plan_template_created",
      expect.objectContaining({ source: "plan_import" }),
    );
    expect(setMealPlanMock).toHaveBeenCalledWith([{ day: 0, meals: [] }]);
    expect(onClose).toHaveBeenCalled();
  });

  it("saves template-only without activating the week", async () => {
    mockFetchOnce(PARSE_OK);
    commitMock.mockResolvedValue({
      ok: true,
      templateId: "tmpl-1",
      recipeIdByKey: {},
      dayPlan: [{ day: 0, meals: [] }],
    });
    render(<PlanImport onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId("plan-import-paste-field"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("plan-import-parse"));
    await waitFor(() => expect(screen.getByTestId("plan-import-review")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("plan-import-save"));
    fireEvent.click(await screen.findByTestId("plan-import-template-only"));

    await waitFor(() => expect(commitMock).toHaveBeenCalledTimes(1));
    // Template-only must NOT replace the active week.
    expect(setMealPlanMock).not.toHaveBeenCalled();
  });

  it("surfaces a commit failure as a toast and keeps the dialog state", async () => {
    mockFetchOnce(PARSE_OK);
    commitMock.mockResolvedValue({ ok: false, error: "No linked meals to save." });
    render(<PlanImport onClose={vi.fn()} />);
    fireEvent.change(screen.getByTestId("plan-import-paste-field"), { target: { value: "x" } });
    fireEvent.click(screen.getByTestId("plan-import-parse"));
    await waitFor(() => expect(screen.getByTestId("plan-import-review")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("plan-import-save"));
    fireEvent.click(await screen.findByTestId("plan-import-activate"));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        "Could not save",
        expect.objectContaining({ description: "No linked meals to save." }),
      ),
    );
    expect(setMealPlanMock).not.toHaveBeenCalled();
  });
});
