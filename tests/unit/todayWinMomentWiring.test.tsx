/**
 * Today win-moment wiring (ENG-798, P5 parity gap #1 + #2).
 *
 * Pins the *composition-root* wiring that gaps #1/#2 were about: the
 * `useWebWinMoment` hook + `WinMomentPlayer` overlay were built and unit-
 * tested but mounted by ZERO live screens. These tests assert the live web
 * Today surface (`NutritionTracker`) now:
 *
 *   #1 — mounts `<WinMomentPlayer testID="today-win-moment">` over the Today
 *        screen when `redesign_winmoment` is ON and a landmark fires (the
 *        calorie ring just closed the day at/under target), and renders the
 *        OLD path (no overlay) when the flag is OFF.
 *   #2 — threads the hook's `pulse` boolean down to the calorie ring so the
 *        progress stroke pulses (`data-pulse="true"`) on the target-hit —
 *        the web colour/motion analog of mobile's success haptic.
 *
 * The win-moment fires on the rising edge (prev → after) via the shared
 * `detectWinMoment` math, so each landmark test renders an empty baseline
 * first, then rerenders with a goal-band meal so the snapshot crosses the
 * landmark boundary with `ready` (post-mount) true.
 *
 * Harness mirrors `nutritionTrackerRender.test.tsx`: AppData + auth + router
 * are mocked so we exercise the real composition root without Supabase.
 * `WinMomentPlayer` is mocked to a tiny stub so the test never pulls the
 * dotLottie WASM runtime — we assert the *wiring* (mount + props), which is
 * what gaps #1/#2 are about; the player's own render is covered by its own
 * suite.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * `TodayHeroStats` renders the calorie ring on BOTH breakpoints (the
 * mobile-web `md:hidden` ring + the desktop `hidden md:block` ring) — CSS,
 * not conditional render, hides one. jsdom mounts both, so there are two
 * `daily-ring-progress` nodes. The pulse prop is threaded to both, so
 * assert via "every ring agrees" rather than a single node.
 */
function ringPulse(getAll: (id: string) => HTMLElement[]): string | null {
  const rings = getAll("daily-ring-progress");
  if (rings.length === 0) throw new Error("no daily-ring-progress rendered");
  const pulses = rings.map((r) => r.getAttribute("data-pulse"));
  // All rings share the same source prop, so they must agree.
  const first = pulses[0];
  for (const p of pulses) {
    if (p !== first) {
      throw new Error(`ring pulse disagreement: ${JSON.stringify(pulses)}`);
    }
  }
  return first;
}

void React;

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

const TARGET = 1800;

const appDataState = {
  current: {
    nutritionTargets: { calories: TARGET, protein: 130, carbs: 180, fat: 55, fiber: 30, waterMl: 2000 },
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

vi.mock("../../src/context/AuthSessionContext.tsx", () => ({
  useAuthSession: () => ({ authedUserId: null, authUserCreatedAt: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => getSearchParams(),
}));

vi.mock("../../src/lib/preferences/useMacroDisplayStyle", () => ({
  useMacroDisplayStyle: () => ["tiles", vi.fn()] as const,
}));

vi.mock("../../src/app/components/ui/use-mobile", () => ({
  useIsDesktop: () => true,
}));

// Flag map driven per-test. `redesign_winmoment` is the only flag this
// suite cares about; everything else stays OFF (matching the cold path).
const flagState: { current: Record<string, boolean> } = { current: {} };
vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn((flag: string) => flagState.current[flag] === true),
  isFeatureDisabled: vi.fn(() => false),
}));

// Stub the dotLottie-backed player so the test never loads the WASM
// runtime. We assert the wrapper testID + celebration prop — i.e. the
// wiring gaps #1/#2 are about — not the player's own animation.
vi.mock("../../src/app/components/ui/win-moment-player.tsx", () => ({
  WinMomentPlayer: ({
    celebration,
    testID,
  }: {
    celebration: string;
    testID?: string;
  }) => (
    <div data-testid={testID ?? "win-moment-player"} data-celebration={celebration} />
  ),
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

// A meal that lands the day inside the goal-hit band (>= 0.85 * target,
// <= target) so the calorie landmark fires on the rising edge from 0.
const goalBandMeal = {
  id: "m1",
  name: "Dinner",
  recipeTitle: "Dinner",
  time: "19:00",
  calories: 1700, // 1700 / 1800 = 0.944 → inside [0.85, 1.0]
  protein: 40,
  carbs: 120,
  fat: 50,
};

function setMeals(meals: unknown[]) {
  appDataState.current = {
    ...appDataState.current,
    mealsForSelectedDate: meals,
    nutritionByDay: meals.length ? { "2026-05-27": meals } : {},
  };
}

/**
 * `NutritionTracker` is wrapped in `React.memo`. In the live app, logging a
 * meal mutates the AppData *context value*, and a context update re-renders
 * consumers even through `memo`. This suite mocks `useAppData` as a plain
 * function (the real `AppDataProvider` is far too heavy to mount), so there is
 * no context value to change — a `rerender` with shallow-equal props would be
 * skipped by memo and the updated mock meals would never be read, so the
 * `0 → goal-band` transition the win-moment fires on would never happen.
 * Returning a fresh `onOpenProgress` identity each call forces exactly the
 * re-render a real context change would have triggered. It must be a PROP
 * change, not a changing `key`: a remount would reset the hook's baseline
 * `prev` to null and the rising-edge detection would never see 0 → 1700.
 */
function freshTracker(): React.ReactElement {
  return <NutritionTracker userTier="free" onOpenProgress={() => {}} />;
}

describe("Today win-moment wiring (gaps #1 + #2)", { timeout: 15_000 }, () => {
  beforeEach(() => {
    // Today's surface only detects on the *live* today key, so freeze the
    // clock to the selectedDateKey.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 27, 19, 0, 0));
    setSearchParams(new URLSearchParams());
    vi.clearAllMocks();
    flagState.current = {};
    // Reset the once-per-day reservation between tests.
    try {
      window.localStorage.clear();
    } catch {
      /* jsdom always has localStorage; defensive */
    }
    setMeals([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flag ON + landmark crossed → mounts WinMomentPlayer and pulses the ring", () => {
    flagState.current = { redesign_winmoment: true };

    // 1) Empty baseline render — the hook captures consumed=0 as `prev` and
    //    must NOT fire (no landmark yet).
    const { rerender, queryByTestId, getByTestId, getAllByTestId } = render(
      freshTracker(),
    );
    expect(queryByTestId("today-win-moment")).toBeNull();
    expect(ringPulse(getAllByTestId)).toBeNull();

    // 2) Log a goal-band meal — consumed crosses 0 → 1700 (>= 0.85 * 1800,
    //    <= 1800), the rising edge into the calorie goal-hit band.
    setMeals([goalBandMeal]);
    rerender(freshTracker());

    // #1 — the overlay mounts with the goal-hit celebration.
    const player = getByTestId("today-win-moment");
    expect(player).toBeInTheDocument();
    expect(player.getAttribute("data-celebration")).toBe("goal-hit");

    // #2 — the calorie ring receives the pulse (gold-gradient celebration
    //      stroke, the web colour/motion analog of mobile's success haptic).
    expect(ringPulse(getAllByTestId)).toBe("true");
  });

  it("flag OFF → old path: no overlay, no ring pulse even when at target", () => {
    flagState.current = {}; // redesign_winmoment OFF

    const { rerender, queryByTestId, getAllByTestId } = render(
      freshTracker(),
    );
    setMeals([goalBandMeal]);
    rerender(freshTracker());

    // The whole win-moment path is inert when the flag is off.
    expect(queryByTestId("today-win-moment")).toBeNull();
    expect(ringPulse(getAllByTestId)).toBeNull();
  });

  it("flag ON but no landmark crossed → no overlay, no pulse (not every log fires)", () => {
    flagState.current = { redesign_winmoment: true };

    // A small snack keeps consumed well below the 0.85 * target band, so
    // no landmark is crossed — the reserved moment must stay silent.
    const snack = { ...goalBandMeal, calories: 300, protein: 5, carbs: 40, fat: 10 };

    const { rerender, queryByTestId, getAllByTestId } = render(
      freshTracker(),
    );
    setMeals([snack]);
    rerender(freshTracker());

    expect(queryByTestId("today-win-moment")).toBeNull();
    expect(ringPulse(getAllByTestId)).toBeNull();
  });
});
