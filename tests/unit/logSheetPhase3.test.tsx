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
 * Mirror of `apps/mobile/tests/unit/logSheetPhase3.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  LogSheet,
  type LogSheetProps,
  type LogSheetRecentEntry,
  type LogSheetSavedMeal,
} from "../../src/app/components/suppr/log-sheet";

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
    open();
    expect(screen.getByText("Log a meal")).toBeDefined();
    expect(screen.getByRole("button", { name: "Close log sheet" })).toBeDefined();
  });
});

describe("LogSheet (web) — search row + right-edge icons (Phase 4 / Next-10 #12)", () => {
  it("search row click fires search.onOpen", () => {
    const onOpen = vi.fn();
    open({ search: { onOpen } });
    fireEvent.click(screen.getByRole("button", { name: "Search foods" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("scan icon click fires barcode.onOpen", () => {
    const onScanOpen = vi.fn();
    open({ barcode: { onOpen: onScanOpen } });
    fireEvent.click(screen.getByRole("button", { name: "Scan barcode" }));
    expect(onScanOpen).toHaveBeenCalledTimes(1);
  });

  it("voice icon click fires voice.onStart", () => {
    const onStart = vi.fn();
    open({ voice: { onStart } });
    fireEvent.click(screen.getByRole("button", { name: "Voice log" }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("photo icon click fires photo.onCapture", () => {
    const onCapture = vi.fn();
    open({ photo: { onCapture } });
    fireEvent.click(screen.getByRole("button", { name: "Photo log" }));
    expect(onCapture).toHaveBeenCalledTimes(1);
  });

  it("locked: true on voice surfaces a (Pro) accessibility hint", () => {
    open({ voice: { onStart: () => {}, locked: true } });
    // Locked icons get the "(Pro)" suffix on the accessible label.
    expect(screen.getByRole("button", { name: "Voice log (Pro)" })).toBeDefined();
  });

  it("locked: true on photo surfaces a (Pro) accessibility hint", () => {
    open({ photo: { onCapture: () => {}, locked: true } });
    expect(screen.getByRole("button", { name: "Photo log (Pro)" })).toBeDefined();
  });

  it("an icon with no callback wired is not rendered (host opted out)", () => {
    open({ barcode: undefined, voice: undefined, photo: undefined });
    expect(screen.queryByRole("button", { name: "Scan barcode" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Voice log" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Photo log" })).toBeNull();
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

describe("LogSheet (web) — 'Or add manually' footer", () => {
  it("renders the footer link when onAddManually is provided", () => {
    open({ onAddManually: () => {} });
    expect(screen.getByRole("button", { name: "Or add manually" })).toBeDefined();
  });

  it("hides the footer link when onAddManually is undefined", () => {
    open({ onAddManually: undefined });
    expect(screen.queryByRole("button", { name: "Or add manually" })).toBeNull();
  });

  it("footer click fires onAddManually", () => {
    const onAddManually = vi.fn();
    open({ onAddManually });
    fireEvent.click(screen.getByRole("button", { name: "Or add manually" }));
    expect(onAddManually).toHaveBeenCalledTimes(1);
  });
});
