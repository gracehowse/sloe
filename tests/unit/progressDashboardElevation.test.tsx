/**
 * ProgressDashboard — page-ground cards take the SOFT lift; the loading
 * skeleton tiles stay FLAT.
 *
 * One-card-treatment rule (Grace 2026-06-09, `docs/decisions/2026-06-09-one-
 * card-treatment-soft-elevation.md`): every card sitting directly on the
 * Progress page ground opts INTO the soft lift (`elevation="card"` →
 * `.card-slab`, `data-soft-elevation="true"`) so the whole stack lifts off the
 * near-tonal page instead of re-blending as flat slabs. The maintenance card is
 * the pinned exemplar here — it flipped from flat slab to soft in this sweep.
 *
 * Two things stay FLAT and are pinned so they don't drift:
 *   1. The SupprCard DEFAULT (`elevation="slab-flat"`) — the system contract is
 *      unchanged; call sites opt into soft, the default never moved (also
 *      pinned by `supprPrimitives` + `cardElevationVariants`).
 *   2. The loading-skeleton tiles — they preview the flat bordered demoted stat
 *      chips, not page-ground content cards, so they keep the bare default.
 */
import * as React from "react";
import { readFileSync, readdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
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
    // ENG-1324 — ProgressDashboard mounts useNutritionHistoryWindow, which
    // asks the context to widen the journal to the 90-day history window.
    ensureNutritionHistory: () => {},
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

describe("ProgressDashboard page-ground cards take the soft lift (2026-06-09)", () => {
  beforeEach(() => {
    mockListSavedMeals.mockClear();
    mockIsFeatureEnabled.mockReset();
    mockIsFeatureEnabled.mockImplementation(() => false);
    profileMaybeSingle.mockResolvedValue({ data: profileRow, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("maintenance card renders the SOFT SupprCard tier (page-ground)", async () => {
    mockIsFeatureEnabled.mockImplementation(() => false);
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.getAttribute("data-slot")).toBe("suppr-card");
    // One-card-treatment: page-ground card opts into soft → `.card-slab`,
    // `data-soft-elevation`, no flat-slab marker, no hairline `border` class.
    expect(card.getAttribute("data-soft-elevation")).toBe("true");
    expect(card.getAttribute("data-flat-slab")).toBeNull();
    expect(card.className.split(/\s+/)).toContain("card-slab");
    expect(card.className.split(/\s+/)).not.toContain("card-slab-flat");
    expect(card.className.split(/\s+/)).not.toContain("border");
  });

  it("soft lift does not depend on design_system_elevation (gate removed)", async () => {
    mockIsFeatureEnabled.mockImplementation(
      (flag: string) => flag === "design_system_elevation",
    );
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.getAttribute("data-soft-elevation")).toBe("true");
    expect(card.className.split(/\s+/)).not.toContain("border");
  });

  it("preserves each card's own spacing/testid (maintenance keeps mb-6 mt-6)", async () => {
    render(<ProgressDashboard />);
    const card = await screen.findByTestId("progress-maintenance-card");
    expect(card.className).toContain("mb-6");
    expect(card.className).toContain("mt-6");
    expect(card.className).toContain("p-4");
  });

  it("keeps the loading-skeleton tile FLAT (previews the flat demoted chips, not a page-ground content card)", async () => {
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

/**
 * ENG-1525 — the tinted-hero carve-out (deliberate amendment).
 *
 * The `progress_hierarchy_v1` branch keeps the ENG-1497 card grammar (flat
 * field) with ONE documented exception: the §1 Trajectory hero carries the
 * `--hero-tint` wash + hairline (decision doc
 * `docs/decisions/2026-07-16-progress-hierarchy-v1.md`). The legacy soft-lift
 * pins above stay scoped to the legacy branch (flag off); these source pins
 * scope the carve-out to exactly one card and keep it TINT-ONLY — no second
 * tinted surface, no shadow smuggled in with it.
 */
describe("progress-hierarchy-v1 tinted hero carve-out (ENG-1525/ENG-1497)", () => {
  const DIR = resolvePath(__dirname, "../../src/app/components/suppr/progress-hierarchy");
  const files = readdirSync(DIR).filter((f) => f.endsWith(".tsx"));
  const read = (f: string) => readFileSync(resolvePath(DIR, f), "utf8");
  const HERO_FILE = "progress-trajectory-hero.tsx";

  it("the hero tint comes ONLY from the --hero-tint token trio", () => {
    const hero = read(HERO_FILE);
    expect(hero).toContain("var(--hero-tint)");
    expect(hero).toContain("var(--hero-tint-to)");
    expect(hero).toContain("var(--hero-tint-border)");
  });

  it("exactly ONE card carries the tint — the show-mode hero, never the trend-only card", () => {
    const hero = read(HERO_FILE);
    // One application of the tint style, marked as the hero.
    expect(hero.match(/style=\{HERO_TINT_STYLE\}/g)).toHaveLength(1);
    expect(hero.match(/data-hero-tint="true"/g)).toHaveLength(1);
    // The trends_only SupprCard stays plain (dignity contract: the tint
    // belongs to the absolute-weight hero only).
    const trendOnlyBlock = hero.slice(
      hero.indexOf('if (surfaceMode === "trends_only")'),
      hero.indexOf("progress-hierarchy-trend-only"),
    );
    expect(trendOnlyBlock).not.toContain("HERO_TINT_STYLE");
    expect(trendOnlyBlock).not.toContain("hero-tint");
  });

  it("no OTHER hierarchy section references the hero tint", () => {
    for (const f of files.filter((f) => f !== HERO_FILE)) {
      expect(read(f), `${f} must not carry the hero tint`).not.toContain("hero-tint");
    }
  });

  it("the carve-out is TINT-only: no shadow, no soft-lift opt-in, no raw colour literals in the hierarchy dir", () => {
    for (const f of files) {
      const src = read(f);
      // New-branch cards stay flat (ENG-1497) — no elevation="card" opt-in
      // and no hand-rolled shadow rides along with the tint.
      expect(src, `${f} opts into the soft lift`).not.toMatch(/elevation="card"/);
      expect(src, `${f} carries a shadow`).not.toMatch(/boxShadow|shadow-/);
      // Tokens only (the hosts have ZERO token-budget headroom; the new files
      // must stay at zero too).
      expect(src, `${f} carries a raw hex colour`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(src, `${f} carries a raw rgb()/rgba() literal`).not.toMatch(/rgba?\(\s*\d/);
    }
  });
});
