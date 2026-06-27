/**
 * logHubQuickActions (mobile) — render harness for the ENG-1247 LogHub
 * quick-action row (Log usual / Copy yesterday / Duplicate day).
 *
 * Mounts the real `<LogSheet>` and exercises the `quickActions` prop:
 *  - the row renders ONLY the actions whose handlers are present (no dead
 *    buttons): 0 saved meals hides "Log usual"; absent copy-yesterday /
 *    duplicate-day entries hide those buttons;
 *  - the "Log usual" label reflects the resolved meal name;
 *  - tapping each button fires the host handler;
 *  - when `quickActions` is wired, the standalone `CopyYesterdayRow`
 *    (testID `copy-yesterday-row`) does NOT double-render.
 *
 * The pure "Log usual" SELECTION logic (slot-match → max logCount →
 * tie-break → fallback) is covered platform-agnostically in the shared
 * `tests/unit/savedMealsLogic.test.ts#selectUsualSavedMeal`; this file
 * covers the mobile UI wiring only.
 *
 * Same harness shape as `logSheetSlotSelector.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { LogSheet, type LogSheetProps } from "../../components/today/LogSheet";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

// LogSheet imports FoodSearchPanel → searchFoods from `@/lib/verifyRecipe`,
// which instantiates a Supabase client at module load and explodes with no
// SUPABASE_URL in the test env. The quick-action tests never touch search —
// a narrow stub is enough (same as logSheetSlotSelector).
vi.mock("@/lib/verifyRecipe", () => ({
  searchFoods: vi.fn(async () => []),
  getFoodMacros: vi.fn(async () => null),
  scaleMacrosByGrams: vi.fn(() => ({
    calories: 0, protein: 0, carbs: 0, fat: 0,
    fiberG: 0, sugarG: 0, sodiumMg: 0,
  })),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    tint: "#5E7C5A",
    navPrimary: "#3a2b3f",
    background: "#fff",
    backgroundSecondary: "#fafafa",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f4f4f4",
    sourceUsda: "#5E7C5A",
    sourceOff: "#4A7878",
    sourceFatsecret: "#C9892C",
    sourceManual: "#94a3b8",
    sourceAi: "#6A4B7A",
    northStarBgFrom: "rgba(88,140,228,0.08)",
    northStarBgTo: "rgba(223,94,188,0.04)",
    northStarBorder: "rgba(88,140,228,0.18)",
    overBudgetFg: "#C0533F",
    overBudgetSoft: "rgba(247,138,50,0.08)",
  }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      visible
      onClose={() => {}}
      search={{ onOpen: () => {} }}
      barcode={{ onOpen: () => {} }}
      recent={{ entries: [], onPick: () => {} }}
      saved={{ meals: [], onPick: () => {} }}
      voice={{ onStart: () => {} }}
      photo={{ onCapture: () => {} }}
      {...props}
    />,
  );
}

describe("LogSheet LogHub quick actions (mobile) — render", () => {
  it("renders no quick-action row when neither copyYesterday nor quickActions is wired", () => {
    const { queryByTestId } = open();
    expect(queryByTestId("loghub-quick-actions")).toBeNull();
    expect(queryByTestId("copy-yesterday-row")).toBeNull();
  });

  it("renders all three buttons when every action is resolvable", () => {
    const { getByTestId } = open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
        copyYesterday: { count: 4, onTap: () => {} },
        duplicateDay: { onTap: () => {} },
      },
    });
    expect(getByTestId("loghub-quick-actions")).toBeTruthy();
    expect(getByTestId("loghub-quick-log-usual")).toBeTruthy();
    expect(getByTestId("loghub-quick-copy-yesterday")).toBeTruthy();
    expect(getByTestId("loghub-quick-duplicate-day")).toBeTruthy();
  });

  it("labels the Log usual button with the resolved meal name", () => {
    const { getByTestId } = open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
      },
    });
    const btn = getByTestId("loghub-quick-log-usual");
    expect(btn.props.accessibilityLabel).toBe("Log Usual breakfast");
  });

  it("hides Log usual when the user has no saved meals (logUsual omitted)", () => {
    const { queryByTestId, getByTestId } = open({
      quickActions: {
        copyYesterday: { count: 2, onTap: () => {} },
        duplicateDay: { onTap: () => {} },
      },
    });
    expect(queryByTestId("loghub-quick-log-usual")).toBeNull();
    // The other two still render.
    expect(getByTestId("loghub-quick-copy-yesterday")).toBeTruthy();
    expect(getByTestId("loghub-quick-duplicate-day")).toBeTruthy();
  });

  it("hides Copy yesterday when that action is omitted (yesterday empty)", () => {
    const { queryByTestId, getByTestId } = open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
        duplicateDay: { onTap: () => {} },
      },
    });
    expect(queryByTestId("loghub-quick-copy-yesterday")).toBeNull();
    expect(getByTestId("loghub-quick-log-usual")).toBeTruthy();
    expect(getByTestId("loghub-quick-duplicate-day")).toBeTruthy();
  });

  it("hides Duplicate day when that action is omitted (today empty)", () => {
    const { queryByTestId, getByTestId } = open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: () => {} },
        copyYesterday: { count: 3, onTap: () => {} },
      },
    });
    expect(queryByTestId("loghub-quick-duplicate-day")).toBeNull();
    expect(getByTestId("loghub-quick-log-usual")).toBeTruthy();
    expect(getByTestId("loghub-quick-copy-yesterday")).toBeTruthy();
  });

  it("renders nothing when quickActions is wired but every entry is absent", () => {
    const { queryByTestId } = open({ quickActions: {} });
    expect(queryByTestId("loghub-quick-actions")).toBeNull();
  });

  it("fires each handler on press", () => {
    const onLogUsual = vi.fn();
    const onCopy = vi.fn();
    const onDuplicate = vi.fn();
    const { getByTestId } = open({
      quickActions: {
        logUsual: { mealName: "Usual breakfast", onTap: onLogUsual },
        copyYesterday: { count: 4, onTap: onCopy },
        duplicateDay: { onTap: onDuplicate },
      },
    });
    fireEvent.press(getByTestId("loghub-quick-log-usual"));
    fireEvent.press(getByTestId("loghub-quick-copy-yesterday"));
    fireEvent.press(getByTestId("loghub-quick-duplicate-day"));
    expect(onLogUsual).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it("does NOT double-render the standalone CopyYesterdayRow when quickActions is wired", () => {
    const { queryByTestId } = open({
      // Both props passed — quickActions must win, the legacy row stays hidden.
      copyYesterday: { count: 5, onTap: () => {} },
      quickActions: {
        copyYesterday: { count: 5, onTap: () => {} },
      },
    });
    expect(queryByTestId("loghub-quick-actions")).toBeTruthy();
    expect(queryByTestId("copy-yesterday-row")).toBeNull();
  });

  it("renders the legacy standalone CopyYesterdayRow when only copyYesterday is wired (flag-off path)", () => {
    const { getByTestId, queryByTestId } = open({
      copyYesterday: { count: 5, onTap: () => {} },
    });
    expect(getByTestId("copy-yesterday-row")).toBeTruthy();
    expect(queryByTestId("loghub-quick-actions")).toBeNull();
  });
});
