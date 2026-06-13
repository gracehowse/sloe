/**
 * ProgressDashboard — render harness (ENG-762).
 *
 * Mocks auth + Supabase profile load so we can assert on the Progress
 * shell without a live session. Heavy chart/digest children keep their
 * own unit tests; this file pins the composition root wiring.
 */
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

void React;

const { mockListSavedMeals, profileRow } = vi.hoisted(() => ({
  mockListSavedMeals: vi.fn().mockResolvedValue([]),
  profileRow: {
    weight_kg: 72,
    goal_weight_kg: 68,
    plan_pace: "steady",
    weight_kg_by_day: { "2026-05-27": 72 },
    steps_by_day: {},
    daily_steps_goal: 8000,
    body_fat_pct: null,
    goal: "lose",
    sex: "female",
    height_cm: 165,
    age: 30,
    activity_level: "moderate",
    adaptive_tdee: null,
    adaptive_tdee_confidence: null,
    adaptive_tdee_updated_at: null,
    week_start_day: "monday",
    streak_freeze_budget_max: 3,
    streak_freezes_earned_at: [],
    streak_freezes_used_history: [],
    weekly_recap_last_seen_week_key: null,
    milestone_30_shown_at: null,
  },
}));

const appDataState = {
  current: {
    nutritionTargets: { calories: 1800, protein: 130, carbs: 180, fat: 55, fiber: 30, waterMl: 2000 },
    nutritionByDay: {
      "2026-05-27": [{ id: "e1", calories: 450, protein: 30, carbs: 40, fat: 12 }],
    },
    profileMeasurementSystem: "metric" as const,
  },
};

vi.mock("../../src/context/AppDataContext.tsx", () => ({
  useAppData: () => appDataState.current,
}));

vi.mock("../../src/context/AuthSessionContext.tsx", () => ({
  useAuthSession: () => ({ authedUserId: "user-1", authUserCreatedAt: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

vi.mock("../../src/lib/nutrition/savedMeals.ts", () => ({
  listSavedMeals: mockListSavedMeals,
}));

vi.mock("../../src/lib/nutrition/dailyTargetRead.ts", () => ({
  getDailyTargets: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../src/lib/nutrition/refreshAdaptiveTdee.ts", () => ({
  refreshAdaptiveTdeeForUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../src/hooks/useMilestone30DayOnProgress.ts", () => ({
  useMilestone30DayOnProgress: () => ({
    open: false,
    dismiss: vi.fn(),
    maybeOpen: vi.fn(),
  }),
}));

vi.mock("../../src/app/components/HouseholdBar.tsx", () => ({
  HouseholdBar: () => null,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
}));

const profileMaybeSingle = vi.fn().mockResolvedValue({ data: profileRow, error: null });

vi.mock("../../src/lib/supabase/browserClient.ts", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: profileMaybeSingle,
          single: profileMaybeSingle,
        })),
        in: vi.fn(() => ({
          maybeSingle: profileMaybeSingle,
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

import { ProgressDashboard } from "../../src/app/components/ProgressDashboard";

describe("ProgressDashboard render harness", () => {
  beforeEach(() => {
    mockListSavedMeals.mockClear();
    profileMaybeSingle.mockResolvedValue({ data: profileRow, error: null });
  });

  it("renders the Progress header after profile load", async () => {
    render(<ProgressDashboard />);
    await waitFor(() => {
      expect(screen.getAllByTestId("progress-header")[0]).toHaveTextContent("Progress");
    });
  });

  it("shows the Apple Health period control once loaded (ENG-1030)", async () => {
    render(<ProgressDashboard />);
    await waitFor(() => {
      // The picker is the period control: D/W/M/6M/Y segments + the ‹ label ›
      // paging row (was the `progress-range-picker` 7d/30d/90d/All pills).
      expect(screen.getByTestId("progress-period-segments")).toBeInTheDocument();
    });
    // The five segments + the paging label render.
    for (const seg of ["D", "W", "M", "6M", "Y"]) {
      expect(screen.getByTestId(`progress-period-segment-${seg}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("progress-period-label")).toBeInTheDocument();
    // The retired relative-range picker is gone.
    expect(screen.queryByTestId("progress-range-picker")).not.toBeInTheDocument();
  });

  it("wires the chart-area swipe accelerator onto the Daily Calories card (ENG-1031)", async () => {
    render(<ProgressDashboard />);
    // The Daily Calories card is the chart surface the period swipe is
    // attached to (`{...periodSwipe}`). The delta/direction/threshold(64)/
    // no-future-clamp maths is pinned at the hook boundary in
    // progressPeriodControl.test.tsx ("usePeriodSwipe"); here we guard the
    // composition wiring — the card exists and is touch-pan-y so vertical
    // scroll survives while horizontal drag pages. (jsdom does not forward
    // PointerEvent.clientX, so the gesture maths can't be re-driven via DOM
    // dispatch — only the hook unit can exercise it honestly.)
    const card = await screen.findByTestId("progress-daily-calories-card");
    expect(card).toBeInTheDocument();
    expect(card.className).toContain("touch-pan-y");
  });
});
