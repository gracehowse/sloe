/**
 * logSheetLibraryTab -- pins the LogSheet's Library tab on web.
 *
 * Sourced from TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8`
 * + sibling reports ("No way to add recipes saved to library from
 * here", "Need to be more obvious ways to access the library"),
 * 2026-05-01.
 *
 * Mirror of `apps/mobile/tests/unit/logSheetLibraryTab.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  LogSheet,
  type LogSheetLibraryRecipe,
} from "../../src/app/components/suppr/log-sheet";

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

const greekSalad: LogSheetLibraryRecipe = {
  id: "rec-greek",
  title: "Greek salad",
  kcalPerPortion: 320,
  thumbnail: null,
  mealTag: "Lunch",
};
const oats: LogSheetLibraryRecipe = {
  id: "rec-oats",
  title: "Banana oats",
  kcalPerPortion: 410,
  thumbnail: null,
  mealTag: "Breakfast",
};

describe("LogSheet (web) -- Library tab (TestFlight Build 40)", () => {
  it("renders the Library pill alongside Recent and Saved meals", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [greekSalad], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    expect(screen.getByRole("tab", { name: "Recent" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Library" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Saved meals" })).toBeDefined();
  });

  it("hides the Library pill when no library prop is wired (host opted out)", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    expect(screen.queryByRole("tab", { name: "Library" })).toBeNull();
  });

  it("renders Library content (title + kcal + tag) after switching to the Library tab", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [greekSalad, oats], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Library" }));
    expect(screen.getByText("Greek salad")).toBeDefined();
    expect(screen.getByText("320 kcal")).toBeDefined();
    expect(screen.getByText("Lunch")).toBeDefined();
    expect(screen.getByText("Banana oats")).toBeDefined();
    expect(screen.getByText("Breakfast")).toBeDefined();
  });

  it("library row click fires onPick with the canonical recipe payload", () => {
    const onPick = vi.fn();
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [greekSalad], onPick }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Log Greek salad" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(greekSalad);
  });

  it("renders the friendly empty state when the user has no saved recipes", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Library" }));
    expect(screen.getByText("No saved recipes yet")).toBeDefined();
    expect(
      screen.getByText(
        /Save recipes from the Recipes tab to see them here\. We.ll show your most-cooked recipes first\./,
      ),
    ).toBeDefined();
  });

  it("empty-state Browse recipes CTA fires onBrowseRecipes", () => {
    const onBrowseRecipes = vi.fn();
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [], onPick: () => {}, onBrowseRecipes }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse recipes" }));
    expect(onBrowseRecipes).toHaveBeenCalledTimes(1);
  });

  it("empty-state Browse recipes CTA is hidden when onBrowseRecipes is undefined", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Library" }));
    expect(screen.queryByRole("button", { name: "Browse recipes" })).toBeNull();
  });

  it("library content renders directly when only library is wired (no toggle needed)", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        library={{ recipes: [greekSalad], onPick: () => {} }}
      />,
    );
    expect(screen.queryByRole("tab", { name: "Recent" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Saved meals" })).toBeNull();
    expect(screen.getByText("Greek salad")).toBeDefined();
  });

  it("library tab order is Recent -> Library -> Saved meals (most-frequent first)", () => {
    render(
      <LogSheet
        open
        onOpenChange={() => {}}
        recent={{ entries: [], onPick: () => {} }}
        library={{ recipes: [], onPick: () => {} }}
        saved={{ meals: [], onPick: () => {} }}
      />,
    );
    const tabs = screen.getAllByRole("tab").map((el) => el.getAttribute("aria-label"));
    expect(tabs).toEqual(["Recent", "Library", "Saved meals"]);
  });
});
