/**
 * ProgressDashboard — SupprCard default elevation (system contract).
 *
 * Progress cards route through bare <SupprCard> with no explicit elevation
 * prop, so they render the SupprCard DEFAULT. That default stays FLAT
 * (`elevation="slab-flat"` → `.card-slab-flat`, no shadow, no hairline) —
 * it is the system contract, unchanged by the one-treatment rule
 * (Grace 2026-06-09, `docs/decisions/2026-06-09-one-card-treatment-soft-
 * elevation.md`): page-ground cards opt INTO soft per call site; the
 * default itself is unchanged (also pinned by `supprPrimitives` +
 * `cardElevationVariants`). The Progress tab was not part of the 2026-06-09
 * web sweep, so these call sites keep the default.
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

describe("ProgressDashboard resting-card flat slab (ENG-795 superseded)", () => {
  beforeEach(() => {
    mockListSavedMeals.mockClear();
    mockIsFeatureEnabled.mockReset();
    mockIsFeatureEnabled.mockImplementation(() => false);
    profileMaybeSingle.mockResolvedValue({ data: profileRow, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("maintenance card renders the flat SupprCard tier by default", async () => {
    mockIsFeatureEnabled.mockImplementation(() => false);
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.getAttribute("data-slot")).toBe("suppr-card");
    expect(card.getAttribute("data-flat-slab")).toBe("true");
    expect(card.className.split(/\s+/)).not.toContain("border");
    expect(card.className.split(/\s+/)).toContain("card-slab-flat");
  });

  it("flat slab does not depend on design_system_elevation (gate removed)", async () => {
    mockIsFeatureEnabled.mockImplementation(
      (flag: string) => flag === "design_system_elevation",
    );
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.getAttribute("data-flat-slab")).toBe("true");
    expect(card.className.split(/\s+/)).not.toContain("border");
  });

  it("preserves each card's own spacing/testid (maintenance keeps mb-6 mt-6)", async () => {
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.className).toContain("mb-6");
    expect(card.className).toContain("mt-6");
    expect(card.className).toContain("p-4");
  });

  it("flat-slabs the loading-skeleton tile too (same paint system)", async () => {
    // Hold the profile read pending so the loading branch stays mounted.
    let resolveLoad: (v: { data: typeof profileRow; error: null }) => void = () => {};
    profileMaybeSingle.mockReturnValue(
      new Promise((res) => {
        resolveLoad = res;
      }),
    );
    render(<ProgressDashboard />);
    const tile = await screen.findByTestId("progress-skeleton-tile-0");
    expect(tile.getAttribute("data-flat-slab")).toBe("true");
    expect(tile.className.split(/\s+/)).not.toContain("border");
    // Skeleton-specific geometry preserved.
    expect(tile.className).toContain("min-h-[86px]");
    // Let the pending load settle so React doesn't warn on unmount.
    await waitFor(() => resolveLoad({ data: profileRow, error: null }));
  });
});
