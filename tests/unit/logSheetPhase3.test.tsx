/**
 * logSheetPhase3 — Pins the Phase 3 (B2.1, 2026-04-27) canonical
 * LogSheet primitive on web.
 *
 * Authority: D-2026-04-27-15 (one canonical log path).
 * Source: src/app/components/suppr/log-sheet.tsx
 *
 * The LogSheet replaces the placeholder alert that the Phase 2 web
 * `<LogFab>` was firing on tap. Every legacy entry-point now routes
 * into one of the six sub-tabs.
 *
 * What's pinned here:
 *   - Sheet primitive shape — header / drag-handle / sub-tab strip /
 *     content area exist when open.
 *   - All six sub-tabs are rendered as accessible tabs.
 *   - Switching tabs swaps the rendered content area.
 *   - Search tab: query change wires through; "+" button fires onAdd.
 *   - Barcode tab: 0-kcal manual-entry path renders the manual form
 *     and Log it commits the captured payload (closes Top Broken
 *     Journey #5).
 *   - Recent tab: empty state copy + grouped Today/Earlier renders.
 *   - Saved tab: empty state copy.
 *   - Voice / Photo: permission-denied surfaces the "grant access"
 *     copy instead of the camera/mic.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import {
  LogSheet,
  type LogSheetProps,
  type LogSheetSearchResult,
  type LogSheetRecentEntry,
  type LogSheetSavedMeal,
} from "../../src/app/components/suppr/log-sheet";

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      open
      onOpenChange={() => {}}
      search={{
        query: "",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
      }}
      barcode={{}}
      recent={{ entries: [], onPick: () => {} }}
      saved={{ meals: [], onPick: () => {} }}
      voice={{}}
      photo={{}}
      {...props}
    />,
  );
}

describe("LogSheet (web) — primitive shape", () => {
  it("renders the canonical header, drag handle, and 6 sub-tabs when open", () => {
    open();
    expect(screen.getByText("Log a meal")).toBeDefined();
    expect(screen.getByRole("button", { name: "Close log sheet" })).toBeDefined();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);

    const labels = tabs.map((t) => t.textContent);
    expect(labels).toContain("Search foods");
    expect(labels).toContain("Scan barcode");
    expect(labels).toContain("Recent");
    expect(labels).toContain("Saved meals");
    expect(labels).toContain("Voice log");
    expect(labels).toContain("Photo log");
  });

  it("does not render the sheet content when closed", () => {
    render(
      <LogSheet
        open={false}
        onOpenChange={() => {}}
        search={{ query: "", onQueryChange: () => {}, results: [], onAdd: () => {} }}
      />,
    );
    expect(screen.queryByText("Log a meal")).toBeNull();
  });

  it("Search tab is the default initial tab", () => {
    open();
    const searchTab = screen.getByRole("tab", { name: "Search foods" });
    expect(searchTab.getAttribute("aria-selected")).toBe("true");
  });

  it("respects an explicit initialTab", () => {
    open({ initialTab: "barcode" });
    const barcodeTab = screen.getByRole("tab", { name: "Scan barcode" });
    expect(barcodeTab.getAttribute("aria-selected")).toBe("true");
  });
});

describe("LogSheet (web) — Search tab", () => {
  it("wires query changes through to onQueryChange", () => {
    const onQueryChange = vi.fn();
    open({
      search: { query: "", onQueryChange, results: [], onAdd: () => {} },
    });
    const input = screen.getByPlaceholderText("Search foods, brands, or recipes…");
    fireEvent.change(input, { target: { value: "chicken" } });
    expect(onQueryChange).toHaveBeenCalledWith("chicken");
  });

  it("fires onAdd when the + button on a result row is tapped", () => {
    const result: LogSheetSearchResult = {
      id: "r1",
      title: "Chicken caesar salad",
      kcal: 420,
      source: "usda",
    };
    const onAdd = vi.fn();
    open({
      search: {
        query: "chicken",
        onQueryChange: () => {},
        results: [result],
        onAdd,
      },
    });
    const addBtn = screen.getByLabelText("Add Chicken caesar salad");
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledWith(result);
  });

  it("renders skeleton rows when state.loading is true", () => {
    open({
      search: {
        query: "x",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
        state: { loading: true },
      },
    });
    // Skeletons use a data-slot — count them via the DOM query.
    const skeletons = document.querySelectorAll('[data-slot="log-sheet-skeleton-row"]');
    expect(skeletons.length).toBe(4);
  });

  it("renders 'No matches' empty state when query has text and results are empty", () => {
    open({
      search: {
        query: "asparagus",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
      },
    });
    expect(screen.getByText('No matches for "asparagus"')).toBeDefined();
    expect(screen.getByText(/Try fewer words, or scan a barcode/)).toBeDefined();
  });

  it("renders 'offline' caption when state.offline is true", () => {
    open({
      search: {
        query: "",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
        state: { offline: true },
      },
    });
    expect(screen.getByText(/You're offline/)).toBeDefined();
  });

  it("renders 'error' band with WifiOff when state.error is true", () => {
    open({
      search: {
        query: "x",
        onQueryChange: () => {},
        results: [],
        onAdd: () => {},
        state: { error: true },
      },
    });
    expect(screen.getByText(/Couldn't search/)).toBeDefined();
  });
});

describe("LogSheet (web) — Barcode 0-kcal manual entry (Top Broken Journey #5)", () => {
  it("renders the manual entry form when manualEntry is supplied", () => {
    open({
      initialTab: "barcode",
      barcode: {
        manualEntry: {
          productName: "Generic almonds",
          brand: "Tesco",
          source: "off",
        },
      },
    });
    expect(screen.getByText("Generic almonds")).toBeDefined();
    expect(screen.getByText("Tesco")).toBeDefined();
    expect(screen.getByText(/No nutrition data — enter manually/)).toBeDefined();
    expect(screen.getByLabelText("Portion in grams")).toBeDefined();
    expect(screen.getByLabelText("Kilocalories")).toBeDefined();
    expect(screen.getByLabelText("Protein grams")).toBeDefined();
  });

  it("commits the captured payload via onConfirmManual", () => {
    const onConfirmManual = vi.fn();
    open({
      initialTab: "barcode",
      barcode: {
        manualEntry: { productName: "Generic almonds" },
        onConfirmManual,
      },
    });
    fireEvent.change(screen.getByLabelText("Portion in grams"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Kilocalories"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Protein grams"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Carbs grams"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Fat grams"), { target: { value: "16" } });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));

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

  it("falls back to defaults (portion 100, others 0) on empty inputs", () => {
    const onConfirmManual = vi.fn();
    open({
      initialTab: "barcode",
      barcode: {
        manualEntry: { productName: "Mystery item" },
        onConfirmManual,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log it" }));
    expect(onConfirmManual.mock.calls[0]?.[0]).toMatchObject({
      portionGrams: 100,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("renders permission denied state when state.permissionDenied is true", () => {
    open({
      initialTab: "barcode",
      barcode: { state: { permissionDenied: true } },
    });
    expect(screen.getByText("Camera access needed")).toBeDefined();
    expect(screen.getByText(/Grant camera access/)).toBeDefined();
  });
});

describe("LogSheet (web) — Recent tab", () => {
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

  it("renders 'Today's recents' and 'Earlier this week' groups when both have entries", () => {
    open({
      initialTab: "recent",
      recent: { entries: [todayEntry, weekEntry], onPick: () => {} },
    });
    expect(screen.getByText("Today's recents")).toBeDefined();
    expect(screen.getByText("Earlier this week")).toBeDefined();
    expect(screen.getByText("Greek yogurt")).toBeDefined();
    expect(screen.getByText("Oats with banana")).toBeDefined();
  });

  it("renders the empty state when entries is empty", () => {
    open({
      initialTab: "recent",
      recent: { entries: [], onPick: () => {} },
    });
    expect(screen.getByText("Your recent foods will appear here")).toBeDefined();
  });

  it("only renders the 'Earlier this week' group when there are no Today entries", () => {
    open({
      initialTab: "recent",
      recent: { entries: [weekEntry], onPick: () => {} },
    });
    expect(screen.queryByText("Today's recents")).toBeNull();
    expect(screen.getByText("Earlier this week")).toBeDefined();
  });

  it("fires onPick when a recent row is tapped", () => {
    const onPick = vi.fn();
    open({
      initialTab: "recent",
      recent: { entries: [todayEntry], onPick },
    });
    fireEvent.click(screen.getByText("Greek yogurt"));
    expect(onPick).toHaveBeenCalledWith(todayEntry);
  });
});

describe("LogSheet (web) — Saved tab", () => {
  const meal: LogSheetSavedMeal = {
    id: "m1",
    title: "My usual oatmeal",
    kcal: 380,
    source: "manual",
  };

  it("renders the empty state when no saved meals", () => {
    open({
      initialTab: "saved",
      saved: { meals: [], onPick: () => {} },
    });
    expect(screen.getByText("No saved meals yet")).toBeDefined();
  });

  it("renders saved meal rows and fires onPick on tap", () => {
    const onPick = vi.fn();
    open({
      initialTab: "saved",
      saved: { meals: [meal], onPick },
    });
    fireEvent.click(screen.getByText("My usual oatmeal"));
    expect(onPick).toHaveBeenCalledWith(meal);
  });
});

describe("LogSheet (web) — Voice tab", () => {
  it("renders the default mic button when no slot supplied", () => {
    open({ initialTab: "voice" });
    expect(screen.getByLabelText("Tap to start recording")).toBeDefined();
  });

  it("renders permission denied state when state.permissionDenied is true", () => {
    open({ initialTab: "voice", voice: { state: { permissionDenied: true } } });
    expect(screen.getByText("Microphone access needed")).toBeDefined();
  });

  it("renders the first-run tip when showFirstRunTip is true", () => {
    open({ initialTab: "voice", voice: { state: { showFirstRunTip: true } } });
    expect(screen.getByText(/Speak naturally/)).toBeDefined();
  });
});

describe("LogSheet (web) — Photo tab", () => {
  it("renders permission denied state when state.permissionDenied is true", () => {
    open({ initialTab: "photo", photo: { state: { permissionDenied: true } } });
    expect(screen.getByText("Camera access needed")).toBeDefined();
  });

  it("renders the shutter button by default", () => {
    open({ initialTab: "photo" });
    expect(screen.getByLabelText("Capture photo")).toBeDefined();
  });
});

describe("LogSheet (web) — tab switching", () => {
  it("switching tabs updates aria-selected and swaps content", () => {
    open({
      recent: {
        entries: [
          { id: "r1", title: "Toast", kcal: 100, source: "manual", bucket: "today" },
        ],
        onPick: () => {},
      },
    });

    const recentTab = screen.getByRole("tab", { name: "Recent" });
    fireEvent.click(recentTab);
    expect(recentTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Today's recents")).toBeDefined();
  });
});
