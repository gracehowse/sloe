/**
 * ProgressDashboard — resting-card elevation flag gate (ENG-822, gap #7).
 *
 * Web parity with the mobile `useCardElevation` hook + the Settings.tsx
 * `settingsCardClass` pattern. The Progress dashboard's resting cards must:
 *   - flag ON  (`design_system_elevation`) → soft `--elev-card-soft` ambient
 *     shadow with the hairline border dropped (`border-0`, no double edge).
 *   - flag OFF → today's static `card-elevated` paint + `border border-border`,
 *     preserved byte-for-byte so the cold path is unchanged.
 *
 * Asserts the elevated class appears ONLY when the flag is on, so a regression
 * that ungates (or hardcodes) the elevation breaks this test.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

void React;

const { mockListSavedMeals, mockIsFeatureEnabled, profileRow } = vi.hoisted(() => ({
  mockListSavedMeals: vi.fn().mockResolvedValue([]),
  // Controllable per test. Default OFF mirrors the production cold path.
  mockIsFeatureEnabled: vi.fn((_flag: string) => false),
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
  isFeatureEnabled: (flag: string) => mockIsFeatureEnabled(flag),
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

describe("ProgressDashboard resting-card elevation gate (design_system_elevation)", () => {
  beforeEach(() => {
    mockListSavedMeals.mockClear();
    mockIsFeatureEnabled.mockReset();
    mockIsFeatureEnabled.mockImplementation(() => false);
    profileMaybeSingle.mockResolvedValue({ data: profileRow, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("flag OFF → maintenance card keeps the legacy card-elevated + border-border paint", async () => {
    mockIsFeatureEnabled.mockImplementation(() => false);
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.className).toContain("card-elevated");
    expect(card.className).toContain("border border-border");
    // The soft-elevation paint must NOT leak into the cold path.
    expect(card.className).not.toContain("shadow-[var(--elev-card-soft)]");
    expect(card.className).not.toContain("border-0");
  });

  it("flag ON → maintenance card uses the soft --elev-card-soft shadow with border dropped", async () => {
    mockIsFeatureEnabled.mockImplementation(
      (flag: string) => flag === "design_system_elevation",
    );
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.className).toContain("shadow-[var(--elev-card-soft)]");
    expect(card.className).toContain("border-0");
    // No double edge: the legacy flat paint + hairline border are gone.
    expect(card.className).not.toContain("card-elevated");
    expect(card.className).not.toContain("border border-border");
  });

  it("flag ON preserves each card's own spacing/testid (maintenance keeps mb-6 mt-6)", async () => {
    mockIsFeatureEnabled.mockImplementation(
      (flag: string) => flag === "design_system_elevation",
    );
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.className).toContain("mb-6");
    expect(card.className).toContain("mt-6");
    expect(card.className).toContain("p-4");
  });

  it("flag ON elevates the loading-skeleton tile too (same paint system)", async () => {
    // Hold the profile read pending so the loading branch stays mounted.
    let resolveLoad: (v: { data: typeof profileRow; error: null }) => void = () => {};
    profileMaybeSingle.mockReturnValue(
      new Promise((res) => {
        resolveLoad = res;
      }),
    );
    mockIsFeatureEnabled.mockImplementation(
      (flag: string) => flag === "design_system_elevation",
    );
    render(<ProgressDashboard />);
    const tile = await screen.findByTestId("progress-skeleton-tile-0");
    expect(tile.className).toContain("shadow-[var(--elev-card-soft)]");
    expect(tile.className).toContain("border-0");
    expect(tile.className).not.toContain("card-elevated");
    // Skeleton-specific geometry preserved.
    expect(tile.className).toContain("min-h-[86px]");
    // Let the pending load settle so React doesn't warn on unmount.
    await waitFor(() => resolveLoad({ data: profileRow, error: null }));
  });
});
