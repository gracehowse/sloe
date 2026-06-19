// @vitest-environment jsdom
/**
 * ENG-1213 — sugar/sodium macro tiles + bars must NOT be wrong-data taps, and
 * the macro-detail screen must not silently render PROTEIN's breakdown for an
 * unsupported macro key. Mobile mirror of the web fix (ENG-1212 / ENG-848).
 *
 * The bug: `TodayDashboardMacroTiles` and `TodayDashboardMacroBars` rendered
 * EVERY tracked macro — including reference-only sugar/sodium — as a tappable
 * control wired to `router.push("/macro-detail", { macro })`. But
 * `macro-detail.tsx`'s `MACRO_CONFIG` only defines protein/carbs/fat/fiber/
 * calories/water, and the screen used `MACRO_CONFIG[macro] ?? MACRO_CONFIG.protein`
 * — so tapping sugar/sodium opened a PROTEIN breakdown under the sugar/sodium
 * name: plausible-but-wrong data, hit by both sighted and screen-reader users.
 *
 * The fix gates the tile/bar affordance AND the screen on a single shared
 * supported-key source (`isMacroDetailSupported`, derived from the keys
 * `MACRO_CONFIG` actually supports), so a tappable tile can never resolve to a
 * macro the screen would render wrong data for.
 *
 * These tests pin BOTH halves as OBSERVABLE behaviour:
 *   (a) protein/carbs/fat/fiber/water tiles + bars are interactive (button
 *       role + onPress); sugar/sodium are plain, non-interactive elements
 *       (no button role, no onPress, no "tap for detail" affordance).
 *   (b) the macro-detail screen, given an unsupported key (sugar), renders the
 *       "No breakdown available" state and NEVER protein's breakdown.
 *
 * Reverting either guard breaks this file.
 */
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "@testing-library/react-native";

// ── Imports under test (vitest hoists the `vi.mock` calls below above these) ──
import { TodayDashboardMacroTiles } from "../../components/today/TodayDashboardMacroTiles";
import { TodayDashboardMacroBars } from "../../components/today/TodayDashboardMacroBars";
import MacroDetailScreen from "../../app/macro-detail";
import {
  MACRO_DETAIL_SUPPORTED_KEYS,
  isMacroDetailSupported,
} from "../../lib/macroDetailConfig";

void React;

// ── (b) macro-detail screen harness: mock the screen's data + nav deps ──
// `useLocalSearchParams` is swapped per-test via `searchParams` so one mock
// can drive the supported/unsupported branches. supabase returns no rows
// (empty day) — the unsupported branch returns BEFORE the list renders anyway,
// so the rows are irrelevant to the assertion; we just need the chain not to
// throw at import time.
const searchParams: { macro?: string; date?: string } = { macro: "sugar" };

function supabaseChain(thenValue: { data: unknown; error: unknown }) {
  const c: Record<string, unknown> = {};
  const methods = ["select", "eq", "in", "order"];
  for (const m of methods) c[m] = vi.fn(() => c);
  (c as { then?: unknown }).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(thenValue).then(onFulfilled);
  return c;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => supabaseChain({ data: [], error: null })),
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

const replaceSpy = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({
    push: vi.fn(),
    navigate: vi.fn(),
    replace: replaceSpy,
    back: vi.fn(),
  }),
  useLocalSearchParams: () => searchParams,
  usePathname: () => "/macro-detail",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const tilesProps = {
  totals: { protein: 96, carbs: 142, fat: 44, fiber: 18 },
  targets: { protein: 140, carbs: 200, fat: 68, fiber: 30 },
  totalWaterMl: 1200,
  waterGoalMl: 2000,
  mealsToday: [],
  onPressMacro: () => {},
  cardColor: "#F6F5F2",
  cardBorderColor: "#E8E2EC",
  borderColor: "#E8E2EC",
  textColor: "#221B26",
  textSecondaryColor: "#6A6072",
  textTertiaryColor: "#9B93A3",
  mutedColor: "#E8E2EC",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  searchParams.macro = "sugar";
  delete searchParams.date;
});

describe("ENG-1213 shared supported-key source (web↔mobile parity)", () => {
  it("tile-affordance set is exactly {protein,carbs,fat,fiber,water} — calories excluded", () => {
    // The interactive tile/bar set is web↔mobile parity (ENG-1213). It is
    // NARROWER than MACRO_CONFIG: calories is excluded because there is no
    // calories tile (calories is the ring). Sugar/sodium are reference-only and
    // never resolve to a breakdown. Web matches this set in MacroDetailPanel.tsx.
    expect([...MACRO_DETAIL_SUPPORTED_KEYS].sort()).toEqual(
      ["carbs", "fat", "fiber", "protein", "water"].sort(),
    );
    expect(isMacroDetailSupported("protein")).toBe(true);
    expect(isMacroDetailSupported("water")).toBe(true);
    // calories is renderable by the SCREEN (via MACRO_CONFIG, ring deep-link)
    // but is NOT a tile/bar affordance — there is no calories tile.
    expect(isMacroDetailSupported("calories")).toBe(false);
    expect(isMacroDetailSupported("sugar")).toBe(false);
    expect(isMacroDetailSupported("sodium")).toBe(false);
  });
});

describe("TodayDashboardMacroTiles — sugar/sodium are not tappable (ENG-1213)", () => {
  it("renders supported macros as interactive (button role + onPress)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...tilesProps}
        trackedMacros={["protein", "carbs", "fat", "fiber", "water"]}
      />,
    );
    for (const macro of ["protein", "carbs", "fat", "fiber", "water"]) {
      const node = getByTestId(`today-macro-tile-${macro}`);
      expect(node.props.accessibilityRole).toBe("button");
      expect(typeof node.props.onPress).toBe("function");
    }
  });

  it("renders sugar + sodium as plain, non-interactive tiles (no button role, no onPress)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...tilesProps}
        trackedMacros={["sugar", "sodium"]}
      />,
    );
    for (const macro of ["sugar", "sodium"]) {
      const node = getByTestId(`today-macro-tile-${macro}`);
      expect(node.props.accessibilityRole).toBeUndefined();
      expect(node.props.onPress).toBeUndefined();
      // and it must not advertise a "tap for detail" affordance to VoiceOver.
      expect(node.props.accessibilityLabel ?? "").not.toMatch(/tap for detail/i);
    }
  });

  it("never calls onPressMacro for sugar/sodium even if the tile is pressed", () => {
    const onPressMacro = vi.fn();
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...tilesProps}
        onPressMacro={onPressMacro}
        trackedMacros={["sugar", "sodium"]}
      />,
    );
    // No onPress wired → a press can't fire the host handler.
    expect(getByTestId("today-macro-tile-sugar").props.onPress).toBeUndefined();
    expect(getByTestId("today-macro-tile-sodium").props.onPress).toBeUndefined();
    expect(onPressMacro).not.toHaveBeenCalled();
  });
});

describe("TodayDashboardMacroBars — sugar/sodium are not tappable (ENG-1213)", () => {
  it("renders supported macros as interactive (button role + onPress)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroBars
        {...tilesProps}
        trackedMacros={["protein", "carbs", "fat", "fiber", "water"]}
      />,
    );
    for (const macro of ["protein", "carbs", "fat", "fiber", "water"]) {
      const node = getByTestId(`today-macro-bar-${macro}`);
      expect(node.props.accessibilityRole).toBe("button");
      expect(typeof node.props.onPress).toBe("function");
    }
  });

  it("renders sugar + sodium as plain, non-interactive rows (no button role, no onPress)", () => {
    const { getByTestId } = render(
      <TodayDashboardMacroBars
        {...tilesProps}
        trackedMacros={["sugar", "sodium"]}
      />,
    );
    for (const macro of ["sugar", "sodium"]) {
      const node = getByTestId(`today-macro-bar-${macro}`);
      expect(node.props.accessibilityRole).toBeUndefined();
      expect(node.props.onPress).toBeUndefined();
    }
  });
});

describe("macro-detail screen — unsupported key never shows protein's breakdown (ENG-1213)", () => {
  it("renders the 'No breakdown available' state for an unsupported macro (sugar)", async () => {
    searchParams.macro = "sugar";
    const { findByTestId, getByText, queryByText } = render(<MacroDetailScreen />);
    // The explicit unsupported state — not protein's screen.
    expect(await findByTestId("macro-detail-unsupported")).toBeTruthy();
    expect(getByText("No breakdown available")).toBeTruthy();
    // Must NOT mislabel as protein, and must NOT render protein's breakdown chrome.
    expect(queryByText("Protein")).toBeNull();
  });

  it("renders the real screen (not the unsupported state) for a supported macro (protein)", async () => {
    searchParams.macro = "protein";
    const { findByTestId, queryByTestId } = render(<MacroDetailScreen />);
    // Supported key → the normal screen, NOT the unsupported empty state.
    // (the empty-day branch renders `macro-detail-empty`, never the protein
    // fallback for an unsupported key.)
    await findByTestId("screen-macro-detail");
    expect(queryByTestId("macro-detail-unsupported")).toBeNull();
  });
});
