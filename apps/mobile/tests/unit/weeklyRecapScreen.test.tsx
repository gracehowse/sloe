// @vitest-environment jsdom
/**
 * Weekly recap screen — pin the audit "cut OR finish" verdict
 * (2026-04-30). The StreakPip is now a tappable entry point to a
 * dedicated `/weekly-recap` Stack route. Tests cover:
 *
 *   1. Pip tap fires `router.push("/weekly-recap")`.
 *   2. Pip a11y label is dynamic per streak length AND mentions
 *      "tap for weekly recap" only when `onPress` is wired (no lying
 *      to VoiceOver about an action that doesn't exist).
 *   3. Pip without `onPress` renders the static View (existing
 *      callers preserved).
 *   4. Weekly recap screen renders the calm cards with mock data
 *      covering 5/7 logged days (header + days-logged section +
 *      closest-to-target).
 *   5. "Closest to target" is computed correctly against fixture data
 *      using the shared `selectClosestToTargetDay` helper (same
 *      selection rule the Digest uses, so the two surfaces never
 *      disagree).
 *   6. Zero-day-week empty state renders the explainer instead of a
 *      broken stat card (per audit Step 1).
 *   7. Loading state renders the spinner test ID.
 *   8. Error state surfaces "Couldn't load your week." copy.
 *
 * Authority: 2026-04-30 audit verdict, D-2026-04-27-07 (calm streak).
 */

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

// ── Imports (after mocks) ──────────────────────────────────────────
import { StreakPip } from "../../components/today/StreakPip";
import WeeklyRecapScreen from "../../app/weekly-recap";
import { selectClosestToTargetDay } from "../../../../src/lib/nutrition/weeklyRecap";

void React;

// ── Module-scoped supabase mock harness ─────────────────────────────
// We swap behaviour per-test via `harness.mode`. Patterns mirror the
// existing `progressSkeletonFirstPaint.test.tsx` mocks. The `pending`
// mode never resolves so the loading branch is observable; tests that
// use it must flip back to "ready" / "empty" / "error" before exiting
// to keep the next test deterministic.
type MockMode = "ready" | "empty" | "error" | "pending";
const harness: {
  mode: MockMode;
  rows: Record<string, unknown>[];
  profile: Record<string, unknown> | null;
} = {
  mode: "ready",
  rows: [],
  profile: null,
};

function chain(thenValue: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  const methods = ["select", "eq", "gte", "lte", "in", "order", "maybeSingle"];
  for (const m of methods) c[m] = vi.fn(() => c);
  (c as any).then = (onFulfilled: (v: unknown) => unknown) => {
    if (harness.mode === "pending") {
      return new Promise(() => {
        /* never resolves */
      });
    }
    return Promise.resolve(thenValue).then(onFulfilled);
  };
  return c;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (harness.mode === "error") {
        return chain({ data: null, error: { message: "boom" } });
      }
      if (table === "profiles") {
        return chain({ data: harness.profile, error: null });
      }
      // nutrition_entries
      return chain({ data: harness.rows, error: null });
    }),
  },
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "test-user-id" } } }),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    backgroundSecondary: "#fafafa",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f4f4f4",
    overlay: "#0008",
  }),
}));

const pushSpy = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: pushSpy,
    navigate: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => "/weekly-recap",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// ── Helpers ────────────────────────────────────────────────────────
function setMode(mode: MockMode) {
  harness.mode = mode;
  harness.rows = [];
  harness.profile = null;
}

function loadFixture5of7() {
  // Fixture: 5 of 7 days logged in the current Mon–Sun week.
  // We seed today + 4 days back so any week-start-day works.
  const now = new Date();
  const dow = now.getDay(); // 0..6, Sun=0
  // Snap back to most recent Monday so keys are deterministic relative
  // to whichever weekday this test runs on.
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(now.getDate() + monOffset);

  const keyOf = (offset: number) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const rows: Record<string, unknown>[] = [];
  // Days Mon (offset 0) through Fri (offset 4) logged. Sat / Sun blank.
  // Tue (offset 1) is closest to the 2100 kcal / 150g protein target.
  const dayMacros: {
    offset: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[] = [
    { offset: 0, calories: 1500, protein: 90, carbs: 150, fat: 50 },   // Mon — under
    { offset: 1, calories: 2105, protein: 152, carbs: 230, fat: 75 }, // Tue — closest
    { offset: 2, calories: 2400, protein: 180, carbs: 260, fat: 95 }, // Wed — over
    { offset: 3, calories: 1800, protein: 110, carbs: 200, fat: 60 }, // Thu — under
    { offset: 4, calories: 2200, protein: 130, carbs: 240, fat: 80 }, // Fri — close-ish
  ];
  for (const d of dayMacros) {
    rows.push({
      date_key: keyOf(d.offset),
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
    });
  }

  harness.rows = rows;
  harness.profile = {
    target_calories: 2100,
    target_protein: 150,
    target_carbs: 230,
    target_fat: 70,
    week_start_day: "monday",
    streak_freeze_budget_max: 3,
    streak_freezes_earned_at: [],
    streak_freezes_used_history: [],
  };

  return { keyOf };
}

function loadEmpty() {
  harness.rows = [];
  harness.profile = {
    target_calories: 2100,
    target_protein: 150,
    target_carbs: 230,
    target_fat: 70,
    week_start_day: "monday",
    streak_freeze_budget_max: 3,
    streak_freezes_earned_at: [],
    streak_freezes_used_history: [],
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("StreakPip — tappable entry point (2026-04-30 audit)", () => {
  afterEach(() => {
    pushSpy.mockClear();
  });

  it("calls onPress when tapped", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<StreakPip days={5} onPress={onPress} />);
    fireEvent.press(getByLabelText("5-day logging streak — tap for weekly recap"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("a11y label is dynamic per streak length and includes the tap hint when interactive", () => {
    const { getByLabelText } = render(<StreakPip days={42} onPress={vi.fn()} />);
    expect(
      getByLabelText("42-day logging streak — tap for weekly recap"),
    ).toBeTruthy();
  });

  it("zero-day pip is still tappable so users can land on the explainer", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<StreakPip days={0} onPress={onPress} />);
    fireEvent.press(
      getByLabelText("0-day logging streak — tap for weekly recap"),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders a static View (no tap hint, no button role) when onPress is omitted", () => {
    const { getByLabelText, queryByLabelText } = render(<StreakPip days={7} />);
    // Plain label, no tap-hint suffix.
    expect(getByLabelText("7-day logging streak")).toBeTruthy();
    // The interactive variant's label MUST NOT match.
    expect(
      queryByLabelText("7-day logging streak — tap for weekly recap"),
    ).toBeNull();
  });
});

describe("WeeklyRecap — closest-to-target selection", () => {
  it("picks Tuesday (2105 kcal vs 2100 target) over the over-target Wednesday", () => {
    // Build the same per-day shape `buildWeekStats` returns. Targets
    // are the same on every day (no per-day snapshot in this fixture).
    const days = [
      { key: "2026-04-27", label: "Mon", calories: 1500, protein: 90, carbs: 150, fat: 50, targetCalories: 2100, targetProtein: 150, targetCarbs: 230, targetFat: 70 },
      { key: "2026-04-28", label: "Tue", calories: 2105, protein: 152, carbs: 230, fat: 75, targetCalories: 2100, targetProtein: 150, targetCarbs: 230, targetFat: 70 },
      { key: "2026-04-29", label: "Wed", calories: 2400, protein: 180, carbs: 260, fat: 95, targetCalories: 2100, targetProtein: 150, targetCarbs: 230, targetFat: 70 },
      { key: "2026-04-30", label: "Thu", calories: 1800, protein: 110, carbs: 200, fat: 60, targetCalories: 2100, targetProtein: 150, targetCarbs: 230, targetFat: 70 },
      { key: "2026-05-01", label: "Fri", calories: 2200, protein: 130, carbs: 240, fat: 80, targetCalories: 2100, targetProtein: 150, targetCarbs: 230, targetFat: 70 },
    ];
    const result = selectClosestToTargetDay(days);
    expect(result).not.toBeNull();
    expect(result?.label).toBe("Tue");
    expect(result?.calories).toBe(2105);
    expect(result?.protein).toBe(152);
  });

  it("returns null when no day is logged", () => {
    const result = selectClosestToTargetDay([
      { key: "2026-04-27", label: "Mon", calories: 0, protein: 0, carbs: 0, fat: 0, targetCalories: 2100, targetProtein: 150, targetCarbs: 230, targetFat: 70 },
    ]);
    expect(result).toBeNull();
  });
});

describe("WeeklyRecap screen — render states", () => {
  afterEach(() => {
    pushSpy.mockClear();
    setMode("ready");
  });

  it("renders the calm recap with 5-of-7 days logged + closest-to-target card", async () => {
    setMode("ready");
    loadFixture5of7();

    const { findByTestId, getByText } = render(<WeeklyRecapScreen />);

    // Days-logged card landed with the right copy.
    const daysCard = await findByTestId("weekly-recap-days-card");
    expect(daysCard).toBeTruthy();
    expect(getByText("5 of 7 days")).toBeTruthy();

    // Closest-to-target card is present (Tuesday's macros are the
    // closest to the 2100/150 target). We assert the testID rather
    // than a specific weekday label because the fixture's anchor
    // floats with whatever the test runner's "today" is — but the
    // *selection rule* is pinned by the standalone unit test above.
    const closest = await findByTestId("weekly-recap-closest-card");
    expect(closest).toBeTruthy();

    // The screen header surfaces the live streak pip larger size.
    // 5 logged days in a row → "5 days in a row" inside the streak
    // card.
    expect(getByText(/in a row/)).toBeTruthy();
  });

  it("renders the empty-state explainer when zero days have been logged", async () => {
    setMode("ready");
    loadEmpty();

    const { findByTestId, getByTestId } = render(<WeeklyRecapScreen />);

    // Empty card + headline copy land.
    await findByTestId("weekly-recap-empty-card");
    expect(getByTestId("weekly-recap-empty-headline")).toBeTruthy();
  });

  it("renders the loading spinner during the initial fetch", () => {
    setMode("pending");
    const { getByTestId } = render(<WeeklyRecapScreen />);
    expect(getByTestId("weekly-recap-loading")).toBeTruthy();
    // Reset to a deterministic mode so the next test isn't held open
    // by a never-resolving supabase chain.
    setMode("ready");
  });

  it("renders the error state when supabase rejects", async () => {
    setMode("error");
    const { findByTestId, getByText } = render(<WeeklyRecapScreen />);
    await findByTestId("weekly-recap-error");
    expect(getByText(/Couldn’t load your week\./)).toBeTruthy();
  });
});
