/**
 * logSheetPhase3 — Pins the LogSheet primitive on web.
 *
 * Authority: D-2026-04-27-15 (one canonical log path).
 * Source: src/app/components/suppr/log-sheet.tsx
 *
 * **Updated 2026-04-28 for the search-first refactor (Next-10 #12 from
 * `docs/ux/teardown-2026-04-28-daily-loop.md`).** The 6-tab strip
 * (Search / Scan / Recent / Saved / Voice / Photo) was replaced with
 * a search-first composition: a single tap-to-open search row with
 * right-edge icons for scan / voice / photo, and a Recent / Saved
 * 2-pill toggle below for the default browse content. The original
 * Phase-3 tests pinned the 6-tab strip's accessibility labels — none
 * of those tests reflect the post-refactor reality. This file pins
 * the new contract; the old tests have been deleted in this rewrite.
 * The file name is kept for git history continuity.
 *
 * **Updated 2026-04-30 for the nested-modal teardown (web parity with
 * mobile commit `1968953`).** When the host wires `search.onSelect`
 * the search row flips from a tap-to-open `<button>` to a real
 * `<Input>` and `<FoodSearchPanel>` mounts inline within the same
 * sheet. Legacy `onOpen`-only callers continue to work — the new
 * tests below pin both shapes.
 *
 * Mirror of `apps/mobile/tests/unit/logSheetPhase3.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  LogSheet,
  type LogSheetProps,
  type LogSheetRecentEntry,
  type LogSheetSavedMeal,
} from "../../src/app/components/suppr/log-sheet";

/**
 * 2026-04-30 — `LogSheet.tsx` now imports `<FoodSearchPanel>` so the
 * search row can render real results inline (the customer-lens
 * nested-modal teardown). The panel debounces and fans out to USDA /
 * OFF / Edamam via `fetch`. None of the inline-mode tests below
 * exercise the network — but the debounce timer + fetch ref still
 * fire, so we stub `fetch` to a permanent no-op. The tests pin the
 * structural contract (input shape, browse-vs-panel switch, query
 * reset on close) — the panel's own behaviour belongs to the
 * foodSearch* test suites.
 */
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, hits: [], products: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
});

function open(props?: Partial<LogSheetProps>) {
  return render(
    <LogSheet
      open
      onOpenChange={() => {}}
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

describe("LogSheet (web) — primitive shape", () => {
  it("renders the canonical title when open", () => {
    // ENG-1303 — `sloe_v3_log` defaults ON, so the header reads "Add to today"
    // (was "Log a meal", still the flag-off kill-switch copy).
    open();
    expect(screen.getByText("Add to today")).toBeDefined();
    expect(screen.getByRole("button", { name: "Close log sheet" })).toBeDefined();
  });
});

describe("LogSheet (web) — inline-search mode (2026-04-30, customer-lens nested-modal teardown)", () => {
  // Inline-search mode is active when the host wires `search.onSelect`.
  // The button-faking-input is replaced by a real `<Input type="text">`
  // and `<FoodSearchPanel>` mounts inside the sheet to render results
  // — no nested dialog hop. These tests pin the structural contract;
  // the panel's own behaviour is covered by the foodSearch* test
  // suites and the web FoodSearch tests.

  it("renders a real text input (not a button) when search.onSelect is wired", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
      />,
    );
    // The <Input> owns the `Search foods` accessibility label in
    // inline mode. The dedicated testID lets RTL find the input
    // directly, matching mobile.
    const input = screen.getByLabelText("Search foods");
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).tagName).toBe("INPUT");
    expect(screen.getByTestId("log-sheet-search-input")).toBeDefined();
    // The legacy tap-to-open button is NOT rendered in inline mode.
    expect(screen.queryByRole("button", { name: "Search foods" })).toBeNull();
  });

  it("does NOT mount FoodSearchPanel when query is empty (Recent / Saved stays visible)", () => {
    const recentEntry: LogSheetRecentEntry = {
      id: "r1",
      title: "Greek yogurt",
      kcal: 130,
      source: "off",
      bucket: "today",
    };
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [recentEntry], onPick: () => {} }}
      />,
    );
    // Empty-query state surfaces the Recent group label — proves the
    // browse area still renders when query is empty.
    expect(screen.getByText("Today’s recents")).toBeDefined();
  });

  it("hides Recent / Saved when query is non-empty (panel takes over)", () => {
    const recentEntry: LogSheetRecentEntry = {
      id: "r1",
      title: "Greek yogurt",
      kcal: 130,
      source: "off",
      bucket: "today",
    };
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [recentEntry], onPick: () => {} }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search foods"), {
      target: { value: "yog" },
    });
    // Recent group label disappears once the panel takes over the
    // content area.
    expect(screen.queryByText("Today’s recents")).toBeNull();
  });

  it("falls back to legacy tap-to-open button when only search.onOpen is wired", () => {
    // Backwards-compat: a host that hasn't migrated yet can still wire
    // `onOpen`; the row stays a `<button>` that fires `onOpen` on click.
    const onOpen = vi.fn();
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onOpen }}
      />,
    );
    expect(screen.queryByTestId("log-sheet-search-input")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Search foods" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("right-edge icons still tap-to-open in inline mode (preserved behaviour)", () => {
    const onScanOpen = vi.fn();
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
        barcode={{ onOpen: onScanOpen }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Scan barcode" }));
    expect(onScanOpen).toHaveBeenCalledTimes(1);
  });

  it("clears the query state when the sheet is closed and re-opened", () => {
    // Returning users land on an empty input, not their previous
    // query — same hygiene the legacy Recent / Saved tab used.
    const recentEntry: LogSheetRecentEntry = {
      id: "r1",
      title: "Greek yogurt",
      kcal: 130,
      source: "off",
      bucket: "today",
    };
    const { rerender } = render(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [recentEntry], onPick: () => {} }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Search foods"), {
      target: { value: "yog" },
    });
    expect(screen.queryByText("Today’s recents")).toBeNull();
    // Close…
    rerender(
      <LogSheet
        open={false}
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [recentEntry], onPick: () => {} }}
      />,
    );
    // …and re-open. Query should be cleared → Recent / Saved visible
    // again.
    rerender(
      <LogSheet
        open
        onOpenChange={() => {}}
        search={{ onSelect: () => {} }}
        recent={{ entries: [recentEntry], onPick: () => {} }}
      />,
    );
    expect(screen.getByText("Today’s recents")).toBeDefined();
  });
});

describe("LogSheet (web) — search row + input mode row (Figma 336:2)", () => {
  it("search row click fires search.onOpen", () => {
    const onOpen = vi.fn();
    open({ search: { onOpen } });
    fireEvent.click(screen.getByRole("button", { name: "Search foods" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("scan icon click fires barcode.onOpen", () => {
    const onScanOpen = vi.fn();
    open({ barcode: { onOpen: onScanOpen } });
    fireEvent.click(screen.getByRole("button", { name: "Scan" }));
    expect(onScanOpen).toHaveBeenCalledTimes(1);
  });

  it("voice icon click fires voice.onStart", () => {
    const onStart = vi.fn();
    open({ voice: { onStart } });
    fireEvent.click(screen.getByRole("button", { name: "Voice" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("photo icon click fires photo.onCapture", () => {
    const onCapture = vi.fn();
    open({ photo: { onCapture } });
    fireEvent.click(screen.getByRole("button", { name: "Photo" }));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it("locked: true on voice surfaces a (Pro) accessibility hint", () => {
    open({ voice: { onStart: () => {}, locked: true } });
    // Locked icons get the "(Pro)" suffix on the accessible label.
    expect(screen.getByRole("button", { name: "Voice (Pro)" })).toBeDefined();
  });

  it("locked: true on photo surfaces a (Pro) accessibility hint", () => {
    open({ photo: { onCapture: () => {}, locked: true } });
    expect(screen.getByRole("button", { name: "Photo (Pro)" })).toBeDefined();
  });

  it("an icon with no callback wired is not rendered (host opted out)", () => {
    open({ barcode: undefined, voice: undefined, photo: undefined });
    expect(screen.queryByRole("button", { name: "Scan" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voice" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Photo" })).toBeNull();
  });
});

describe("LogSheet (web) — Recent / Saved browse pills (Phase 4 / Next-10 #12)", () => {
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
    open({ recent: { entries: [todayEntry, weekEntry], onPick: () => {} } });
    expect(screen.getByText("Today’s recents")).toBeDefined();
    expect(screen.getByText("Earlier this week")).toBeDefined();
  });

  it("recent empty state when no entries", () => {
    open({ recent: { entries: [], onPick: () => {} } });
    expect(screen.getByText("Your recent foods will appear here")).toBeDefined();
  });

  it("recent row click fires onPick with the entry", () => {
    const onPick = vi.fn();
    open({ recent: { entries: [todayEntry], onPick } });
    fireEvent.click(screen.getByRole("button", { name: "Log Greek yogurt" }));
    expect(onPick).toHaveBeenCalledWith(todayEntry);
  });

  it("saved tab switch reveals saved meals (and hides recents)", () => {
    open({
      recent: { entries: [todayEntry], onPick: () => {} },
      saved: { meals: [meal], onPick: () => {} },
    });
    expect(screen.getByText("Today’s recents")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Saved meals" }));
    expect(screen.queryByText("Today’s recents")).toBeNull();
    expect(screen.getByText("My usual oatmeal")).toBeDefined();
  });

  it("saved empty state when no meals", () => {
    open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: [], onPick: () => {} },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Saved meals" }));
    expect(screen.getByText("No saved meals yet")).toBeDefined();
  });

  it("ENG-776 — saved empty state fires onCreateSavedMeal", () => {
    const onCreateSavedMeal = vi.fn();
    open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: [], onPick: () => {}, onCreateSavedMeal },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Saved meals" }));
    fireEvent.click(screen.getByRole("button", { name: "Save a usual meal" }));
    expect(onCreateSavedMeal).toHaveBeenCalledTimes(1);
  });

  it("saved row click fires onPick with the meal", () => {
    const onPick = vi.fn();
    // Explicitly clear `recent` so the Recent / Saved 2-pill toggle
    // is hidden (the LogSheet only renders the toggle when both
    // sources are provided). With recent undefined, saved meals
    // render directly without needing a tab switch.
    open({ recent: undefined, saved: { meals: [meal], onPick } });
    fireEvent.click(screen.getByRole("button", { name: "Log My usual oatmeal" }));
    expect(onPick).toHaveBeenCalledWith(meal);
  });
});

describe("LogSheet (web) — saved-tab discoverability dot (2026-05-01, journey-architect P1)", () => {
  // Discoverability nudge: when the user has 3+ saved meals we render
  // a small dot on the Saved tab so first-time-openers learn the tab
  // exists. Below 3, no dot. Pinned here so future refactors don't
  // silently regress the threshold. Mobile parity in
  // `apps/mobile/tests/unit/logSheetPhase3.test.tsx`.
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
    open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: [oneMeal], onPick: () => {} },
    });
    expect(screen.queryByTestId("log-sheet-tab-saved-dot")).toBeNull();
  });

  it("shows the dot when the user has 3+ saved meals", () => {
    open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: threeMeals, onPick: () => {} },
    });
    expect(screen.getByTestId("log-sheet-tab-saved-dot")).toBeDefined();
  });

  it("the Saved-meals tab carries an accessible saved-count label when the dot is showing", () => {
    open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: threeMeals, onPick: () => {} },
    });
    expect(
      screen.getByRole("tab", { name: "Saved meals — 3 saved" }),
    ).toBeDefined();
  });

  it("Recent and Saved tabs use the Figma underline tab rail", () => {
    open({
      recent: { entries: [], onPick: () => {} },
      saved: { meals: threeMeals, onPick: () => {} },
    });
    const recentTab = screen.getByTestId("log-sheet-tab-recent");
    const savedTab = screen.getByTestId("log-sheet-tab-saved");
    expect(recentTab.className).toMatch(/border-b-2/);
    expect(savedTab.className).toMatch(/border-b-2/);
  });
});

describe("LogSheet (web) — Barcode 0-kcal manual entry", () => {
  it("renders the manual-entry form when manualEntry is supplied (replaces default content)", () => {
    open({
      barcode: {
        manualEntry: { productName: "Generic almonds", brand: "Tesco" },
      },
    });
    expect(screen.getByText("Generic almonds")).toBeDefined();
    expect(screen.getByText("Tesco")).toBeDefined();
    expect(screen.getByLabelText("Portion in grams")).toBeDefined();
    expect(screen.getByLabelText("Kilocalories")).toBeDefined();
    // Default search row is suppressed in manual-entry mode.
    expect(screen.queryByRole("button", { name: "Search foods" })).toBeNull();
  });

  it("commits the captured payload via onConfirmManual", () => {
    const onConfirmManual = vi.fn();
    open({
      barcode: {
        manualEntry: { productName: "Generic almonds" },
        onConfirmManual,
      },
    });
    fireEvent.change(screen.getByLabelText("Portion in grams"), {
      target: { value: "30" },
    });
    fireEvent.change(screen.getByLabelText("Kilocalories"), {
      target: { value: "180" },
    });
    fireEvent.change(screen.getByLabelText("Protein grams"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Carbs grams"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Fat grams"), {
      target: { value: "16" },
    });
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
});

describe("LogSheet (web) — Quick add input mode (Figma 336:2)", () => {
  it("renders Quick add when onAddManually is provided", () => {
    open({ onAddManually: () => {} });
    expect(screen.getByRole("button", { name: "Quick add" })).toBeDefined();
  });

  it("hides Quick add when onAddManually is undefined", () => {
    open({ onAddManually: undefined });
    expect(screen.queryByRole("button", { name: "Quick add" })).toBeNull();
  });

  it("Quick add click fires onAddManually", () => {
    const onAddManually = vi.fn();
    open({ onAddManually });
    fireEvent.click(screen.getByRole("button", { name: "Quick add" }));
    expect(onAddManually).toHaveBeenCalledTimes(1);
  });
});

describe("LogSheet (web) — S13 logged-confirmation (Figma 202:2)", () => {
  // Presentation-only success state shown AFTER the host commits a log.
  // The LogSheet never persists anything; it confirms what the host
  // already logged and offers Done / Undo.
  const confirmation = {
    title: "Greek yogurt",
    kcal: 130,
    slot: "Breakfast",
    source: "off" as const,
  };

  it("renders the confirmation card with slot-aware headline + estimated kcal", () => {
    open({ confirmation: { ...confirmation, onDone: () => {} } });
    expect(screen.getByText("Logged to Breakfast")).toBeDefined();
    expect(screen.getByText("Greek yogurt")).toBeDefined();
    // Trust posture — nutrition is always an estimate, never absolute.
    expect(screen.getByText("Est. 130 kcal")).toBeDefined();
  });

  it("falls back to a bare 'Logged' headline when no slot is supplied", () => {
    open({ confirmation: { title: "Greek yogurt", kcal: 130, onDone: () => {} } });
    expect(screen.getByText("Logged")).toBeDefined();
  });

  it("suppresses the search + browse composition while confirming", () => {
    open({
      recent: { entries: [], onPick: () => {} },
      confirmation: { ...confirmation, onDone: () => {} },
    });
    expect(screen.queryByLabelText("Search foods")).toBeNull();
    expect(
      screen.queryByText("Your recent foods will appear here"),
    ).toBeNull();
  });

  it("Done fires onDone", () => {
    const onDone = vi.fn();
    open({ confirmation: { ...confirmation, onDone } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders Undo only when onUndo is wired, and tapping it fires onUndo", () => {
    const onUndo = vi.fn();
    const { rerender } = open({
      confirmation: { ...confirmation, onDone: () => {} },
    });
    // The button's accessible name comes from its `aria-label` ("Undo log"),
    // not its visible text ("Undo").
    expect(screen.queryByRole("button", { name: "Undo log" })).toBeNull();
    rerender(
      <LogSheet
        open
        onOpenChange={() => {}}
        confirmation={{ ...confirmation, onDone: () => {}, onUndo }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo log" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
