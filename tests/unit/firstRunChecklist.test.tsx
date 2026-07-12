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

import { toast } from "sonner";
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

  // ENG-1548 — the completion toast fires at most once per user, regardless
  // of the flag. Previously the once-per-user guard sat inside the
  // `toastGateOn && (...)` clause, so with the flag OFF (the default here)
  // the green "You're all set" toast re-fired on every load that completed
  // onboarding.
  const allDone = {
    savedRecipesForLibrary: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
    mealPlan: [{ day: 1, meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } }],
    nutritionByDay: { "2026-06-18": [{ id: "logged-1" }] },
  };

  it("fires the completion toast once and records the shown flag (flag off)", () => {
    appDataState.current = allDone as never;
    render(<FirstRunChecklist onNavigate={vi.fn()} />);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("suppr-checklist-toast-shown")).toBe("1");
  });

  it("does NOT re-fire the toast once the shown flag is set (flag off)", () => {
    localStorage.setItem("suppr-checklist-toast-shown", "1");
    appDataState.current = allDone as never;
    render(<FirstRunChecklist onNavigate={vi.fn()} />);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
