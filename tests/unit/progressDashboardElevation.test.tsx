/**
 * ProgressDashboard — resting-card elevation flag gate (ENG-822, gap #7).
 *
 * Web parity with the mobile `useCardElevation` hook. The Progress dashboard's
 * resting cards are now routed through the canonical <SupprCard> primitive,
 * which owns the `design_system_elevation` flag-gate internally:
 *   - flag ON  → soft `--elev-card-soft` ambient shadow (inline boxShadow) with
 *     the hairline border dropped — surfaced as `data-soft-elevation="true"`
 *     and no `border` utility class (one edge, no double line).
 *   - flag OFF → flat `card` tier: no soft-elevation marker, hairline border
 *     class kept, byte-for-byte cold path.
 *
 * This is the end-to-end render check for the elevation behaviour (component →
 * SupprCard → DOM); the source-match siblings (settings/mealPlanner/today
 * sweeps) only assert the call sites use the primitive.
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

  it("flag OFF → maintenance card renders the flat SupprCard tier (border kept, no soft elevation)", async () => {
    mockIsFeatureEnabled.mockImplementation(() => false);
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    // ENG-822: the card is a <SupprCard>. Flag OFF → flat `card` tier.
    expect(card.getAttribute("data-slot")).toBe("suppr-card");
    expect(card.getAttribute("data-soft-elevation")).toBeNull();
    expect(card.className.split(/\s+/)).toContain("border");
  });

  it("flag ON → maintenance card adopts the SupprCard soft elevation with the border dropped", async () => {
    mockIsFeatureEnabled.mockImplementation(
      (flag: string) => flag === "design_system_elevation",
    );
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    // Soft tier: data-soft-elevation marker set, hairline border class dropped
    // (the --elev-card-soft shadow itself is an inline boxShadow on SupprCard).
    expect(card.getAttribute("data-soft-elevation")).toBe("true");
    expect(card.className.split(/\s+/)).not.toContain("border");
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
    expect(tile.getAttribute("data-soft-elevation")).toBe("true");
    expect(tile.className.split(/\s+/)).not.toContain("border");
    // Skeleton-specific geometry preserved.
    expect(tile.className).toContain("min-h-[86px]");
    // Let the pending load settle so React doesn't warn on unmount.
    await waitFor(() => resolveLoad({ data: profileRow, error: null }));
  });
});
