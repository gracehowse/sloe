/**
 * logSheetPhase3 — Pins the LogSheet primitive on mobile.
 *
 * Authority: D-2026-04-27-15 (one canonical log path).
 * Source: apps/mobile/components/today/LogSheet.tsx
 *
 * **Updated 2026-04-28 for the search-first refactor (Next-10 #12 from
 * `docs/ux/teardown-2026-04-28-daily-loop.md`).** The 6-tab strip
 * (Search / Scan / Recent / Saved / Voice / Photo) was replaced with
 * a search-first composition: a single tap-to-open search row with
 * right-edge icons for scan / voice / photo, and a Recent / Saved
 * 2-pill toggle below for the default browse content. The original
 * Phase-3 tests pinned the 6-tab strip's accessibility labels and
 * tab-switching behaviour — none of those tests reflect the
 * post-refactor reality. This file pins the new contract; the old
 * tests have been deleted in this rewrite. The file name is kept
 * for git history continuity.
 *
 * Same shape as the web mirror at
 * `tests/unit/logSheetPhase3.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import {
  LogSheet,
  type LogSheetProps,
  type LogSheetRecentEntry,
  type LogSheetSavedMeal,
} from "../../components/today/LogSheet";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
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
    sourceUsda: "#22a860",
    sourceOff: "#4c6ce0",
    sourceFatsecret: "#f97316",
    sourceManual: "#94a3b8",
    sourceAi: "#e04888",
    northStarBgFrom: "rgba(76,108,224,0.08)",
    northStarBgTo: "rgba(224,72,136,0.04)",
    northStarBorder: "rgba(76,108,224,0.18)",
    overBudgetFg: "#e8a020",
    overBudgetSoft: "rgba(232,160,32,0.08)",
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

describe("LogSheet (mobile) — primitive shape", () => {
  it("renders the canonical title when visible", () => {
    const { getByText } = open();
    expect(getByText("Log a meal")).toBeTruthy();
  });

  it("renders nothing when not visible", () => {
    const { queryByText } = render(
      <LogSheet
        visible={false}
        onClose={() => {}}
        search={{ onOpen: () => {} }}
      />,
    );
    expect(queryByText("Log a meal")).toBeNull();
  });

  it("close button fires onClose", () => {
    const onClose = vi.fn();
    const { getByLabelText } = open({ onClose });
    fireEvent.press(getByLabelText("Close log sheet"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("LogSheet (mobile) — search row + right-edge icons (Phase 4 / Next-10 #12)", () => {
  it("search row tap fires search.onOpen", () => {
    const onOpen = vi.fn();
    const { getByLabelText } = open({ search: { onOpen } });
    fireEvent.press(getByLabelText("Search foods"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("scan icon tap fires barcode.onOpen", () => {
    const onScanOpen = vi.fn();
    const { getByLabelText } = open({ barcode: { onOpen: onScanOpen } });
    fireEvent.press(getByLabelText("Scan barcode"));
    expect(onScanOpen).toHaveBeenCalledTimes(1);
  });

  it("voice icon tap fires voice.onStart", () => {
    const onStart = vi.fn();
    const { getByLabelText } = open({ voice: { onStart } });
    fireEvent.press(getByLabelText("Voice log"));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("photo icon tap fires photo.onCapture", () => {
    const onCapture = vi.fn();
    const { getByLabelText } = open({ photo: { onCapture } });
    fireEvent.press(getByLabelText("Photo log"));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it("locked: true on voice surfaces a (Pro) accessibility hint", () => {
    const { getByLabelText } = open({
      voice: { onStart: () => {}, locked: true },
    });
    // Locked icons get the "(Pro)" suffix on their accessibility
    // label so screen readers announce the gate. The icon's own
    // tap callback still fires regardless — host decides whether
    // to open the AI paywall sheet or the real flow.
    expect(getByLabelText("Voice log (Pro)")).toBeTruthy();
  });

  it("locked: true on photo surfaces a (Pro) accessibility hint", () => {
    const { getByLabelText } = open({
      photo: { onCapture: () => {}, locked: true },
    });
    expect(getByLabelText("Photo log (Pro)")).toBeTruthy();
  });

  it("an icon with no callback wired is not rendered (host opted out)", () => {
    const { queryByLabelText } = open({
      barcode: undefined,
      voice: undefined,
      photo: undefined,
    });
    expect(queryByLabelText("Scan barcode")).toBeNull();
    expect(queryByLabelText("Voice log")).toBeNull();
    expect(queryByLabelText("Photo log")).toBeNull();
  });
});

describe("LogSheet (mobile) — Recent / Saved browse pills (Phase 4 / Next-10 #12)", () => {
  const todayEntry: LogSheetRecentEntry = {
    id: "t1",
    title: "Greek yogurt",
    kcal: 130,
    source: "off",
    bucket: "today",
  };
  const weekEntry: LogSheetRecentEntry = {
    id: "w1",
    title: "Oats with banana",
    kcal: 320,
    source: "usda",
    bucket: "week",
  };
  const meal: LogSheetSavedMeal = {
    id: "m1",
    title: "My usual oatmeal",
    kcal: 380,
    source: "manual",
  };

  it("renders Today + Earlier groups when both buckets have entries", () => {
    const { getByText } = open({
      recent: { entries: [todayEntry, weekEntry], onPick: () => {} },
    });
    expect(getByText("Today's recents")).toBeTruthy();
    expect(getByText("Earlier this week")).toBeTruthy();
  });

  it("recent empty state when no entries", () => {
    const { getByText } = open({
      recent: { entries: [], onPick: () => {} },
    });
    expect(getByText("Your recent foods will appear here")).toBeTruthy();
  });

  it("recent row tap fires onPick with the entry", () => {
    const onPick = vi.fn();
    const { getByLabelText } = open({
      recent: { entries: [todayEntry], onPick },
    });
    fireEvent.press(getByLabelText("Log Greek yogurt"));
    expect(onPick).toHaveBeenCalledWith(todayEntry);
  });

  it("saved tab switch reveals saved meals (and hides recents)", () => {
    const { getByText, queryByText, getByLabelText } = open({
      recent: { entries: [todayEntry], onPick: () => {} },
      saved: { meals: [meal], onPick: () => {} },
    });
    // Default lands on Recent.
    expect(getByText("Today's recents")).toBeTruthy();
    fireEvent.press(getByLabelText("Saved meals"));
    // Recent group label is gone, saved meal is visible.
    expect(queryByText("Today's recents")).toBeNull();
    expect(getByText("My usual oatmeal")).toBeTruthy();
  });

  it("saved empty state when no meals", () => {
    const { getByText, getByLabelText } = open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: [], onPick: () => {} },
    });
    fireEvent.press(getByLabelText("Saved meals"));
    expect(getByText("No saved meals yet")).toBeTruthy();
  });

  it("saved row tap fires onPick with the meal", () => {
    const onPick = vi.fn();
    const { getByLabelText } = open({
      // Explicitly clear `recent` so the Recent / Saved 2-pill toggle
      // is hidden (the LogSheet only renders the toggle when both
      // sources are provided). With recent undefined, saved meals
      // render directly without needing a tab switch.
      recent: undefined,
      saved: { meals: [meal], onPick },
    });
    fireEvent.press(getByLabelText("Log My usual oatmeal"));
    expect(onPick).toHaveBeenCalledWith(meal);
  });
});

describe("LogSheet (mobile) — Barcode 0-kcal manual entry", () => {
  it("renders the manual-entry form when manualEntry is supplied (replaces default content)", () => {
    const { getByText, getByLabelText, queryByLabelText } = open({
      barcode: {
        manualEntry: { productName: "Generic almonds", brand: "Tesco" },
      },
    });
    expect(getByText("Generic almonds")).toBeTruthy();
    expect(getByText("Tesco")).toBeTruthy();
    expect(getByLabelText("Portion in grams")).toBeTruthy();
    expect(getByLabelText("Kilocalories")).toBeTruthy();
    // Default search row is suppressed in manual-entry mode.
    expect(queryByLabelText("Search foods")).toBeNull();
  });

  it("commits the captured payload via onConfirmManual", () => {
    const onConfirmManual = vi.fn();
    const { getByLabelText } = open({
      barcode: {
        manualEntry: { productName: "Generic almonds" },
        onConfirmManual,
      },
    });
    fireEvent.changeText(getByLabelText("Portion in grams"), "30");
    fireEvent.changeText(getByLabelText("Kilocalories"), "180");
    fireEvent.changeText(getByLabelText("Protein grams"), "6");
    fireEvent.changeText(getByLabelText("Carbs grams"), "5");
    fireEvent.changeText(getByLabelText("Fat grams"), "16");
    fireEvent.press(getByLabelText("Log it"));
    expect(onConfirmManual).toHaveBeenCalledTimes(1);
    expect(onConfirmManual.mock.calls[0]?.[0]).toMatchObject({
      productName: "Generic almonds",
      portionGrams: 30,
      kcal: 180,
      protein: 6,
      carbs: 5,
      fat: 16,
    });
  });
});

describe("LogSheet (mobile) — 'Or add manually' footer", () => {
  it("renders the footer link when onAddManually is provided", () => {
    const { getByLabelText } = open({ onAddManually: () => {} });
    expect(getByLabelText("Or add manually")).toBeTruthy();
  });

  it("hides the footer link when onAddManually is undefined", () => {
    const { queryByLabelText } = open({ onAddManually: undefined });
    expect(queryByLabelText("Or add manually")).toBeNull();
  });

  it("footer tap fires onAddManually", () => {
    const onAddManually = vi.fn();
    const { getByLabelText } = open({ onAddManually });
    fireEvent.press(getByLabelText("Or add manually"));
    expect(onAddManually).toHaveBeenCalledTimes(1);
  });
});
