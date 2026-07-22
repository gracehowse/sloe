/**
 * logSessionTray (mobile) — render harness for the ENG-1643 session tray.
 * Spec: `docs/specs/2026-07-21-log-session-tray.md` §11.2.
 *
 * Mounts the real `<LogSheet>` and exercises the `sessionTray` prop:
 *  - no prop ⇒ nothing renders (the sheet behaves as pre-ENG-1643);
 *  - items ⇒ collapsed bar with count + running kcal total + `~` trust marker;
 *  - expand ⇒ rows + total footer + correct CTAs;
 *  - Undo fires with the right item + disables while in flight;
 *  - Done fires; Save-as-meal renders only at ≥ 2;
 *  - multi-slot rows carry the `· {Slot}` suffix.
 *
 * The pure tray math is covered platform-agnostically in
 * `tests/unit/logSessionTray.test.ts`; this file covers the mobile UI wiring.
 * Same mock set as `logHubQuickActions.test.tsx` (avoids Supabase/haptics init).
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { LogSheet, type LogSheetProps } from "../../components/today/LogSheet";
import type { LogSessionTrayItem } from "@suppr/shared/nutrition/logSessionTray";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

// Trust marker (`~`) is gated behind `kcal_trust_qualifier_v1` (mirroring S13).
// Force it ON so the tray's verified/unverified `~` logic is exercised; every
// other flag stays off (the LogSheet's default-composition baseline).
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  isFeatureEnabled: (flag: string) => flag === "kcal_trust_qualifier_v1",
}));

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
    text: "#000", textSecondary: "#555", textTertiary: "#888",
    tint: "#5E7C5A", navPrimary: "#3a2b3f", background: "#fff",
    backgroundSecondary: "#fafafa", card: "#fff", cardBorder: "#eee",
    border: "#eee", inputBg: "#f4f4f4", skeleton: "#eee",
    sourceUsda: "#5E7C5A", sourceOff: "#4A7878", sourceFatsecret: "#C9892C",
    sourceManual: "#94a3b8", sourceAi: "#6A4B7A",
    northStarBgFrom: "rgba(88,140,228,0.08)", northStarBgTo: "rgba(223,94,188,0.04)",
    northStarBorder: "rgba(88,140,228,0.18)", overBudgetFg: "#C0533F",
    overBudgetSoft: "rgba(247,138,50,0.08)",
  }),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function item(partial: Partial<LogSessionTrayItem> = {}): LogSessionTrayItem {
  return {
    mealId: "m1", title: "Chicken breast", kcal: 165,
    protein: 31, carbs: 0, fat: 3.6, slot: "Dinner",
    kcalIsVerified: true, ...partial,
  };
}

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

function tray(overrides?: Partial<NonNullable<LogSheetProps["sessionTray"]>>) {
  return {
    items: [] as LogSessionTrayItem[],
    pendingUndoIds: [] as string[],
    onUndo: () => {},
    onDone: () => {},
    ...overrides,
  };
}

describe("LogSheet session tray (mobile) — render", () => {
  it("renders nothing when no sessionTray prop is threaded (pre-ENG-1643)", () => {
    const { queryByTestId } = open();
    expect(queryByTestId("log-session-tray")).toBeNull();
  });

  it("renders nothing when sessionTray has zero items", () => {
    const { queryByTestId } = open({ sessionTray: tray() });
    expect(queryByTestId("log-session-tray")).toBeNull();
  });

  it("renders the collapsed bar with count + running kcal total once items exist", () => {
    const { getByTestId, getByText } = open({
      sessionTray: tray({
        items: [
          item({ mealId: "a", kcal: 165, kcalIsVerified: true }),
          item({ mealId: "b", kcal: 200, kcalIsVerified: true }),
        ],
      }),
    });
    expect(getByTestId("log-session-tray")).toBeTruthy();
    // all-verified ⇒ NO tilde
    expect(getByText("2 added · 365 kcal")).toBeTruthy();
  });

  it("shows the honest ~ when any item is unverified", () => {
    const { getByText } = open({
      sessionTray: tray({
        items: [
          item({ mealId: "a", kcal: 165, kcalIsVerified: true }),
          item({ mealId: "b", kcal: 200, kcalIsVerified: false }),
        ],
      }),
    });
    expect(getByText("2 added · ~365 kcal")).toBeTruthy();
  });

  it("surfaces the count in the sheet title, in every state", () => {
    const { getByText } = open({
      sessionTray: tray({ items: [item({ mealId: "a" }), item({ mealId: "b" })] }),
    });
    expect(getByText("Log a meal · 2 added")).toBeTruthy();
  });

  it("expands to per-item rows + a total footer when the bar is tapped", () => {
    const { getByTestId, getByText, queryByTestId } = open({
      sessionTray: tray({
        items: [item({ mealId: "a", title: "Oats" }), item({ mealId: "b", title: "Milk" })],
      }),
    });
    expect(queryByTestId("log-session-tray-row-0")).toBeNull();
    fireEvent.press(getByTestId("log-session-tray-toggle"));
    expect(getByTestId("log-session-tray-row-0")).toBeTruthy();
    expect(getByTestId("log-session-tray-row-1")).toBeTruthy();
    expect(getByText("Added this session")).toBeTruthy();
    expect(getByText("Total")).toBeTruthy();
  });

  it("Save-as-usual-meal renders only at ≥ 2 items", () => {
    const one = open({
      sessionTray: tray({ items: [item({ mealId: "a" })], onSaveMeal: () => {} }),
    });
    fireEvent.press(one.getByTestId("log-session-tray-toggle"));
    expect(one.queryByTestId("log-session-tray-save-meal")).toBeNull();

    const two = open({
      sessionTray: tray({
        items: [item({ mealId: "a" }), item({ mealId: "b" })],
        onSaveMeal: () => {},
      }),
    });
    fireEvent.press(two.getByTestId("log-session-tray-toggle"));
    expect(two.getByTestId("log-session-tray-save-meal")).toBeTruthy();
  });

  it("appends the slot suffix to rows only when the tray spans multiple slots", () => {
    const multi = open({
      sessionTray: tray({
        items: [
          item({ mealId: "a", title: "Toast", kcal: 100, kcalIsVerified: true, slot: "Breakfast" }),
          item({ mealId: "b", title: "Soup", kcal: 100, kcalIsVerified: true, slot: "Lunch" }),
        ],
      }),
    });
    fireEvent.press(multi.getByTestId("log-session-tray-toggle"));
    expect(multi.getByText("100 kcal · Breakfast")).toBeTruthy();
    expect(multi.getByText("100 kcal · Lunch")).toBeTruthy();

    // Single-slot ⇒ no suffix.
    const single = open({
      sessionTray: tray({
        items: [
          item({ mealId: "a", title: "Toast", kcal: 100, kcalIsVerified: true, slot: "Breakfast" }),
          item({ mealId: "b", title: "Eggs", kcal: 100, kcalIsVerified: true, slot: "Breakfast" }),
        ],
      }),
    });
    fireEvent.press(single.getByTestId("log-session-tray-toggle"));
    expect(single.getAllByText("100 kcal").length).toBe(2);
  });

  it("Done fires the host handler", () => {
    const onDone = vi.fn();
    const { getByTestId } = open({
      sessionTray: tray({ items: [item({ mealId: "a" })], onDone }),
    });
    fireEvent.press(getByTestId("log-session-tray-done"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Undo fires with the right item", () => {
    const onUndo = vi.fn();
    const { getByTestId } = open({
      sessionTray: tray({
        items: [item({ mealId: "meal-xyz", title: "Oats" })],
        onUndo,
      }),
    });
    fireEvent.press(getByTestId("log-session-tray-toggle"));
    fireEvent.press(getByTestId("log-session-tray-undo-0"));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo.mock.calls[0]![0].mealId).toBe("meal-xyz");
  });

  it("disables a row's ✕ while its removal is in flight (pendingUndoIds)", () => {
    const onUndo = vi.fn();
    const { getByTestId } = open({
      sessionTray: tray({
        items: [item({ mealId: "meal-xyz", title: "Oats" })],
        pendingUndoIds: ["meal-xyz"],
        onUndo,
      }),
    });
    fireEvent.press(getByTestId("log-session-tray-toggle"));
    const undoBtn = getByTestId("log-session-tray-undo-0");
    expect(undoBtn.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(undoBtn);
    // Disabled ⇒ no double-submit.
    expect(onUndo).not.toHaveBeenCalled();
  });
});
