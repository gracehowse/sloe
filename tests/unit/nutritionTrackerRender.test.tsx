/**
 * NutritionTracker — render harness.
 *
 * Mocks AppData + auth + router so we can assert on the Today shell
 * without a live Supabase session. Child primitives (LogSheet tabs,
 * FoodSearchPanel) keep their own unit tests; this file pins the
 * composition root wiring.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

void React;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  ResizeObserverStub;

const { mockReplace, getSearchParams, setSearchParams } = vi.hoisted(() => {
  let params = new URLSearchParams();
  return {
    mockReplace: vi.fn(),
    getSearchParams: () => params,
    setSearchParams: (next: URLSearchParams) => {
      params = next;
    },
  };
});

const appDataState = {
  current: {
    nutritionTargets: { calories: 1800, protein: 130, carbs: 180, fat: 55, fiber: 30, waterMl: 2000 },
    setNutritionTargets: vi.fn(),
    selectedDateKey: "2026-05-27",
    setSelectedDateKey: vi.fn(),
    mealsForSelectedDate: [] as unknown[],
    addLoggedMeal: vi.fn(),
    addLoggedMealForDate: vi.fn(),
    removeLoggedMeal: vi.fn(),
    copyMealToDate: vi.fn(),
    copyMealToDateRange: vi.fn(),
    duplicateDay: vi.fn(),
    duplicateDayToDateRange: vi.fn(),
    mealPlan: { slots: [] },
    savedRecipesForLibrary: [],
    preferActivityAdjustedCalories: false,
    setPreferActivityAdjustedCalories: vi.fn(),
    activityBurnForSelectedDay: 0,
    activityBurnByDay: {},
    addWaterMlForSelectedDay: vi.fn(),
    extraWaterMlForSelectedDay: 0,
    addCaffeineMgForSelectedDay: vi.fn(),
    extraCaffeineMgForSelectedDay: 0,
    extraCaffeineByDay: {},
    addAlcoholGForSelectedDay: vi.fn(),
    extraAlcoholGByDay: {},
    resetHydrationStimulantsForDay: vi.fn(),
    targetCaffeineMg: 400,
    targetAlcoholGWeekly: 140,
    workoutsByDay: {},
    basalBurnByDay: {},
    profileMeasurementSystem: "metric" as const,
    nutritionJournalHydrated: true,
    nutritionByDay: {} as Record<string, unknown[]>,
    extraWaterByDay: {},
    notificationPrefs: { mealReminders: false, weeklyCheckin: false },
    profileDisplayName: "Grace",
    authEmail: "grace@example.com",
    netCarbsLensEnabled: false,
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

// Today greeting now reads the name from the auth user's
// `user_metadata` (the "Your name" Settings field writes `full_name`),
// NOT `profileDisplayName`. `authMetadataState` lets individual tests
// flip the metadata to assert the greeting personalises / falls back.
const authMetadataState = {
  current: { full_name: "Grace" } as Record<string, unknown>,
};
vi.mock("../../src/context/AuthSessionContext.tsx", () => ({
  useAuthSession: () => ({
    authedUserId: null,
    authUserCreatedAt: null,
    authUserMetadata: authMetadataState.current,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => getSearchParams(),
}));

vi.mock("../../src/lib/preferences/useMacroDisplayStyle", () => ({
  useMacroDisplayStyle: () => ["tiles", vi.fn()] as const,
}));

vi.mock("../../src/app/components/ui/use-mobile", () => ({
  useIsDesktop: () => false,
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

import { NutritionTracker } from "../../src/app/components/NutritionTracker";
const loggedMeal = {
  id: "m1",
  name: "Oats",
  recipeTitle: "Oats",
  time: "08:00",
  calories: 420,
  protein: 15,
  carbs: 60,
  fat: 8,
};

describe("NutritionTracker render harness", { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    setSearchParams(new URLSearchParams());
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    appDataState.current = {
      ...appDataState.current,
      mealsForSelectedDate: [],
      nutritionByDay: {},
      selectedDateKey: "2026-05-27",
      removeLoggedMeal: vi.fn(),
    };
    // Reset the greeting name source between tests (the "Your name"
    // field writes `user_metadata.full_name`).
    authMetadataState.current = { full_name: "Grace" };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the Today shell on a fresh day", () => {
    render(<NutritionTracker userTier="free" onOpenSettings={() => {}} />);
    expect(screen.getByTestId("today-meals-empty-cta")).toBeInTheDocument();
    expect(screen.getByTestId("today-meals-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("today-hero-desktop")).toBeInTheDocument();
  });

  it("renders the v3 serif date hero (weekday name + short date), not a greeting", () => {
    // ENG-1247 (2026-06-24): the Today hero is the serif DATE — a weekday name
    // + a short-date subline — not a time-of-day "Afternoon, Grace" greeting.
    render(<NutritionTracker userTier="free" />);
    const hero = screen.getByTestId("today-hero-greeting");
    // every English weekday name ends in "day" (Wednesday/Tuesday/...)
    expect(hero.textContent ?? "").toMatch(/day$/i);
    expect(hero).not.toHaveTextContent("Afternoon");
    // the short-date subline carries the day-of-month (27 May 2026 fixture)
    expect(
      screen.getByTestId("today-hero-greeting-subline").textContent ?? "",
    ).toMatch(/May/);
  });

  it("the date hero is name-independent (no greeting, so metadata name never shows)", () => {
    // The v3 hero dropped the personalised greeting entirely, so a name in
    // auth metadata must NOT leak into the hero.
    authMetadataState.current = { full_name: "Grace Turner" };
    render(<NutritionTracker userTier="free" />);
    expect(screen.getByTestId("today-hero-greeting")).not.toHaveTextContent("Grace");
  });

  it("shows hero stat labels once the user has logged kcal", () => {
    appDataState.current = {
      ...appDataState.current,
      mealsForSelectedDate: [loggedMeal],
      nutritionByDay: { "2026-05-27": [loggedMeal] },
    };
    render(<NutritionTracker userTier="free" />);
    const statRow = screen.getByTestId("today-hero-stat-row");
    expect(within(statRow).getByText("420")).toBeInTheDocument();
    expect(screen.queryByTestId("today-meals-empty-cta")).not.toBeInTheDocument();
  });

  it(
    "opens LogSheet from ?openLog=1 and clears the URL param",
    async () => {
      vi.useRealTimers();
      setSearchParams(new URLSearchParams("openLog=1"));
      render(<NutritionTracker userTier="free" />);
      await waitFor(
        () => {
          expect(screen.getByTestId("log-sheet-search-input")).toBeInTheDocument();
        },
        { timeout: 10_000 },
      );
      expect(mockReplace).toHaveBeenCalledWith("/home", { scroll: false });
    },
    15_000,
  );

  it("opens LogSheet when the empty-state CTA is clicked", async () => {
    vi.useRealTimers();
    render(<NutritionTracker userTier="free" />);
    expect(screen.queryByTestId("log-sheet-search-input")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("today-meals-empty-cta"));
    await waitFor(() => {
      expect(screen.getByTestId("log-sheet-search-input")).toBeInTheDocument();
    });
  });

  it("does not show missed-yesterday copy — banner retired (F-07)", () => {
    appDataState.current = {
      ...appDataState.current,
      nutritionByDay: {
        "2026-05-25": [loggedMeal],
        "2026-05-26": [],
      },
    };
    render(<NutritionTracker userTier="free" />);
    expect(
      screen.queryByTestId("today-missed-yesterday-copy"),
    ).not.toBeInTheDocument();
  });

  it("shows the offline banner when navigator.onLine is false", () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    render(<NutritionTracker userTier="free" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/offline/i);
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });
});
