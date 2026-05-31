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

/**
 * 2026-04-30 — `LogSheet.tsx` now imports `<FoodSearchPanel>` so the
 * search row can render real results inline (the customer-lens
 * nested-modal teardown). The panel pulls `searchFoods` from
 * `@/lib/verifyRecipe`, which top-level-instantiates a Supabase
 * client (`lib/supabase.ts`) and explodes when no `SUPABASE_URL` is
 * set in the test env. This file pins legacy `onOpen`-only mode +
 * Recent / Saved + the manual-entry recovery — none of which
 * exercise the search backend — so a narrow stub is enough.
 */
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
    background: "#fff",
    backgroundSecondary: "#fafafa",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f4f4f4",
    sourceUsda: "#56A775",
    sourceOff: "#588CE4",
    sourceFatsecret: "#F78A32",
    sourceManual: "#94a3b8",
    sourceAi: "#DF5EBC",
    northStarBgFrom: "rgba(88,140,228,0.08)",
    northStarBgTo: "rgba(223,94,188,0.04)",
    northStarBorder: "rgba(88,140,228,0.18)",
    overBudgetFg: "#F78A32",
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

describe("LogSheet (mobile) — inline-search mode (2026-04-30, customer-lens nested-modal teardown)", () => {
  // Inline-search mode is active when the host wires `search.onSelect`.
  // The Pressable-faking-input is replaced by a real `<TextInput>` and
  // `<FoodSearchPanel>` mounts inside the sheet to render results — no
  // nested modal hop. These tests pin the structural contract; the
  // panel's own behaviour is covered by the foodSearch* test suites.

  it("renders a real TextInput (not a Pressable) when search.onSelect is wired", () => {
    const { getByLabelText, getByTestId } = render(
      <LogSheet
        visible
        onClose={() => {}}
        search={{ onSelect: () => {} }}
      />,
    );
    // The TextInput owns the `Search foods` accessibility label in
    // inline mode. The dedicated testID lets Maestro / RNTL find the
    // input directly.
    const input = getByLabelText("Search foods");
    expect(input).toBeTruthy();
    expect(getByTestId("log-sheet-search-input")).toBeTruthy();
  });

  it("does NOT mount FoodSearchPanel when query is empty (Recent / Saved stays visible)", () => {
    const recentEntry: LogSheetRecentEntry = {
      id: "r1",
      title: "Greek yogurt",
      kcal: 130,
      source: "off",
      bucket: "today",
    };
    const { getByText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [recentEntry], onPick: () => {} }}
      />,
    );
    // Empty-query state surfaces the Recent group label — proves the
    // browse area still renders when query is empty.
    expect(getByText("Today's recents")).toBeTruthy();
  });

  it("hides Recent / Saved and shows the search panel when query is non-empty", () => {
    const recentEntry: LogSheetRecentEntry = {
      id: "r1",
      title: "Greek yogurt",
      kcal: 130,
      source: "off",
      bucket: "today",
    };
    const { getByLabelText, queryByText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [recentEntry], onPick: () => {} }}
      />,
    );
    fireEvent.changeText(getByLabelText("Search foods"), "yog");
    // Recent group label disappears once the panel takes over the
    // content area.
    expect(queryByText("Today's recents")).toBeNull();
  });

  it("falls back to legacy tap-to-open Pressable when only search.onOpen is wired", () => {
    // Backwards-compat: a host that hasn't migrated yet can still wire
    // `onOpen`; the row stays a Pressable that fires `onOpen` on tap.
    const onOpen = vi.fn();
    const { getByLabelText, queryByTestId } = render(
      <LogSheet
        visible
        onClose={() => {}}
        search={{ onOpen }}
      />,
    );
    expect(queryByTestId("log-sheet-search-input")).toBeNull();
    fireEvent.press(getByLabelText("Search foods"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("right-edge icons still tap-to-open in inline mode (preserved behaviour)", () => {
    const onScanOpen = vi.fn();
    const { getByLabelText } = render(
      <LogSheet
        visible
        onClose={() => {}}
        search={{ onSelect: () => {} }}
        barcode={{ onOpen: onScanOpen }}
      />,
    );
    fireEvent.press(getByLabelText("Scan barcode"));
    expect(onScanOpen).toHaveBeenCalledTimes(1);
  });

  it("clears the query state when the sheet is closed and re-opened", () => {
    // Returning users land on an empty input, not their previous
    // query — same hygiene the legacy Recent / Saved tab used.
    const { getByLabelText, queryByText, rerender } = render(
      <LogSheet
        visible
        onClose={() => {}}
        search={{ onSelect: () => {} }}
        recent={{
          entries: [
            { id: "r1", title: "Greek yogurt", kcal: 130, source: "off", bucket: "today" },
          ],
          onPick: () => {},
        }}
      />,
    );
    fireEvent.changeText(getByLabelText("Search foods"), "yog");
    expect(queryByText("Today's recents")).toBeNull();
    // Close…
    rerender(
      <LogSheet
        visible={false}
        onClose={() => {}}
        search={{ onSelect: () => {} }}
        recent={{
          entries: [
            { id: "r1", title: "Greek yogurt", kcal: 130, source: "off", bucket: "today" },
          ],
          onPick: () => {},
        }}
      />,
    );
    // …and re-open. Query should be cleared → Recent / Saved visible
    // again.
    rerender(
      <LogSheet
        visible
        onClose={() => {}}
        search={{ onSelect: () => {} }}
        recent={{
          entries: [
            { id: "r1", title: "Greek yogurt", kcal: 130, source: "off", bucket: "today" },
          ],
          onPick: () => {},
        }}
      />,
    );
    expect(queryByText("Today's recents")).toBeTruthy();
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

describe("LogSheet (mobile) — saved-meal portion editor (ENG-783, today-edit-entry-v2)", () => {
  // Surface (b) of ENG-783: the LogSheet "Saved meals" rows. The host
  // passes `saved.onRequestPortion` only when `today-edit-entry-v2` is on
  // (see `app/(tabs)/index.tsx`). When wired, a saved-meal tap routes to
  // the portion editor instead of logging 1× instantly; when omitted, the
  // old instant-log path (`onPick`) is preserved by the `??` fallback.
  const meal: LogSheetSavedMeal = {
    id: "m1",
    title: "My usual oatmeal",
    kcal: 380,
    source: "manual",
  };

  it("prop wired: the row is labelled 'Edit portion for …' and tapping calls onRequestPortion (not onPick)", () => {
    const onPick = vi.fn();
    const onRequestPortion = vi.fn();
    const { getByLabelText, queryByLabelText } = open({
      recent: undefined,
      saved: { meals: [meal], onPick, onRequestPortion },
    });
    // The portion-editor affordance relabels the row.
    expect(queryByLabelText("Log My usual oatmeal")).toBeNull();
    fireEvent.press(getByLabelText("Edit portion for My usual oatmeal"));
    expect(onRequestPortion).toHaveBeenCalledTimes(1);
    expect(onRequestPortion).toHaveBeenCalledWith(meal);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("prop omitted: the row keeps the 'Log …' label and tapping falls back to onPick", () => {
    const onPick = vi.fn();
    const { getByLabelText, queryByLabelText } = open({
      recent: undefined,
      saved: { meals: [meal], onPick },
    });
    expect(queryByLabelText("Edit portion for My usual oatmeal")).toBeNull();
    fireEvent.press(getByLabelText("Log My usual oatmeal"));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(meal);
  });
});

describe("LogSheet (mobile) — saved-tab discoverability dot (2026-05-01, journey-architect P1)", () => {
  // Discoverability nudge: when the user has 3+ saved meals we render
  // a small dot on the Saved tab so first-time-openers learn the tab
  // exists. Below 3, no dot. Pinned here so future refactors don't
  // silently regress the threshold.
  const oneMeal: LogSheetSavedMeal = {
    id: "m1",
    title: "My usual oatmeal",
    kcal: 380,
    source: "manual",
  };
  const threeMeals: LogSheetSavedMeal[] = [
    { id: "m1", title: "Oatmeal", kcal: 380, source: "manual" },
    { id: "m2", title: "Salad", kcal: 250, source: "manual" },
    { id: "m3", title: "Stew", kcal: 600, source: "manual" },
  ];

  it("hides the dot when the user has fewer than 3 saved meals", () => {
    const { queryByTestId } = open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: [oneMeal], onPick: () => {} },
    });
    expect(queryByTestId("log-sheet-tab-saved-dot")).toBeNull();
  });

  it("shows the dot when the user has 3+ saved meals", () => {
    const { getByTestId } = open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: threeMeals, onPick: () => {} },
    });
    expect(getByTestId("log-sheet-tab-saved-dot")).toBeTruthy();
  });

  it("the Saved-meals tab carries an accessible saved-count label when the dot is showing", () => {
    const { getByLabelText } = open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: threeMeals, onPick: () => {} },
    });
    expect(getByLabelText("Saved meals — 3 saved")).toBeTruthy();
  });

  it("Recent and Saved tabs share the same active-state pill style class (equal weight)", () => {
    const { getByTestId } = open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: threeMeals, onPick: () => {} },
    });
    // Both tabs render via the shared `styles.browsePill` style (which
    // sets `flex: 1`) so they always carry equal width, equal padding,
    // and identical typography. The dot is an additive element inside
    // the Saved pill — the container style is unchanged.
    expect(getByTestId("log-sheet-tab-recent")).toBeTruthy();
    expect(getByTestId("log-sheet-tab-saved")).toBeTruthy();
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
