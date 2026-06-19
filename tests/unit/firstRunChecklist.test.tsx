import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

void React;

const appDataState = {
  current: {
    savedRecipesForLibrary: [],
    mealPlan: null,
    nutritionByDay: {},
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => false,
}));

const trackMock = vi.fn();
vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

import { FirstRunChecklist } from "../../src/app/components/FirstRunChecklist";

describe("FirstRunChecklist", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    appDataState.current = {
      savedRecipesForLibrary: [],
      mealPlan: null,
      nutritionByDay: {},
    };
  });

  it("renders only the next unfinished step so it stays compact", () => {
    render(<FirstRunChecklist onNavigate={vi.fn()} />);

    const checklist = screen.getByTestId("first-run-checklist");
    const nextStep = within(checklist).getByTestId("first-run-checklist-next-step");

    expect(nextStep).toHaveTextContent("Start with your dashboard");
    expect(checklist).not.toHaveTextContent("Plan meals when you're ready");
    expect(checklist).not.toHaveTextContent("Save recipes to cook later");
  });

  it("advances through the next unfinished step", () => {
    const onNavigate = vi.fn();
    appDataState.current = {
      savedRecipesForLibrary: [],
      mealPlan: null,
      nutritionByDay: {
        "2026-06-18": [{ id: "meal-1" }],
      },
    };

    render(<FirstRunChecklist onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId("first-run-checklist-next-step"));

    expect(onNavigate).toHaveBeenCalledWith("planner");
  });
});
