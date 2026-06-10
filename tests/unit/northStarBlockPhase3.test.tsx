/**
 * northStarBlockPhase3 — pins the Phase 3 (B2.2, 2026-04-27)
 * `<NorthStarBlock>` web primitive.
 *
 * Authority: D-2026-04-27-04 (north-star moment).
 * Source: src/app/components/suppr/north-star-block.tsx
 *
 * What's pinned:
 *   - Default kind: renders eyebrow, title, band chip, macro caption,
 *     CTA. Tap fires onPrimaryCta. Skip button fires onSkip.
 *   - Library-empty kind: renders the invitation copy + "Open Library →".
 *   - Over-budget kind: renders the calm caption (no card, no CTA).
 *   - No-fit kind: renders "Library has nothing under your remaining
 *     macros today" + Browse → text button.
 *   - The success-tinted band chip is used only when bandTight is true.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  NorthStarBlock,
  type NorthStarBlockSuggestion,
} from "../../src/app/components/suppr/north-star-block";

let figmaMealsLayout = true;

vi.mock("../../src/lib/analytics/track", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) =>
    flag === "today_meals_figma_654" ? figmaMealsLayout : false,
}));

const baseSuggestion: NorthStarBlockSuggestion = {
  recipeId: "rec-1",
  title: "Tofu poke bowl",
  predictedCalories: 520,
  predictedProtein: 38,
  predictedCarbs: 42,
  predictedFat: 18,
  bandLabel: "Hits within 3%",
  bandTight: true,
};

describe("NorthStarBlock (web) — Figma 654 hero", () => {
  beforeEach(() => {
    figmaMealsLayout = true;
  });

  it("renders section title, recipe hero, slot eyebrow, and kcal", () => {
    render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        slotEyebrow="Dinner suggestion"
      />,
    );
    expect(screen.getByText("What to eat next")).toBeDefined();
    expect(screen.getByText("Tofu poke bowl")).toBeDefined();
    expect(screen.getByText("Dinner suggestion")).toBeDefined();
    expect(screen.getByText("Fits your day")).toBeDefined();
    expect(screen.getByText(/520 kcal/)).toBeDefined();
  });

  it("hero tap fires onPrimaryCta", () => {
    const onPrimaryCta = vi.fn();
    render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        slotEyebrow="Dinner suggestion"
        onPrimaryCta={onPrimaryCta}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Dinner suggestion: Tofu poke bowl, 520 kcal/,
      }),
    );
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });

  it("skip button fires onSkip without opening hero", () => {
    const onSkip = vi.fn();
    const onPrimaryCta = vi.fn();
    render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        slotEyebrow="Dinner suggestion"
        onSkip={onSkip}
        onPrimaryCta={onPrimaryCta}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip this suggestion" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onPrimaryCta).not.toHaveBeenCalled();
  });
});

describe("NorthStarBlock (web) — compact default kind", () => {
  beforeEach(() => {
    figmaMealsLayout = false;
  });

  it("renders the eyebrow, title, band chip and macro caption", () => {
    render(<NorthStarBlock kind="default" suggestion={baseSuggestion} ctaLabel="Log it" />);
    expect(screen.getByText("What to eat next")).toBeDefined();
    expect(screen.getByText("Tofu poke bowl")).toBeDefined();
    expect(screen.getByText("Hits within 3%")).toBeDefined();
    expect(screen.getByText(/520 kcal · 38g P · 42g C · 18g F/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Log it" })).toBeDefined();
  });

  it("primary CTA fires onPrimaryCta on click", () => {
    const onPrimaryCta = vi.fn();
    render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        ctaLabel="Cook it →"
        onPrimaryCta={onPrimaryCta}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cook it →" }));
    expect(onPrimaryCta).toHaveBeenCalledTimes(1);
  });

  it("renders skip button only when onSkip is provided; click fires onSkip", () => {
    const onSkip = vi.fn();
    const { rerender } = render(
      <NorthStarBlock kind="default" suggestion={baseSuggestion} onSkip={onSkip} />,
    );
    const skip = screen.getByRole("button", { name: "Skip this suggestion" });
    fireEvent.click(skip);
    expect(onSkip).toHaveBeenCalledTimes(1);

    rerender(<NorthStarBlock kind="default" suggestion={baseSuggestion} />);
    expect(screen.queryByRole("button", { name: "Skip this suggestion" })).toBeNull();
  });

  it("uses the success-tinted band chip only when bandTight=true", () => {
    const { rerender } = render(
      <NorthStarBlock kind="default" suggestion={baseSuggestion} />,
    );
    const tightChip = screen.getByText("Hits within 3%");
    expect(tightChip.getAttribute("data-band")).toBe("tight");

    rerender(
      <NorthStarBlock
        kind="default"
        suggestion={{
          ...baseSuggestion,
          bandLabel: "Close fit",
          bandTight: false,
        }}
      />,
    );
    const looseChip = screen.getByText("Close fit");
    expect(looseChip.getAttribute("data-band")).toBe("soft");
  });

  it("uses RecipeHeroFallback when thumbnail is absent", () => {
    render(<NorthStarBlock kind="default" suggestion={baseSuggestion} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("opens why dialog when whyLine is tapped", () => {
    render(
      <NorthStarBlock
        kind="default"
        suggestion={{
          ...baseSuggestion,
          whyLine: "Closes your protein gap for lunch",
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Closes your protein gap/,
      }),
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Why this suggestion?" })).toBeDefined();
  });

  it("renders an img when thumbnail is supplied", () => {
    render(
      <NorthStarBlock
        kind="default"
        suggestion={{ ...baseSuggestion, thumbnail: "https://example.com/x.jpg" }}
      />,
    );
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/x.jpg");
  });
});

describe("NorthStarBlock (web) — whyLine + macro row do not overlap", () => {
  beforeEach(() => {
    figmaMealsLayout = false;
  });

  // Parity mirror of the mobile regression guard for the 2026-06-04
  // "Fits your remaining N kcal" overlap report. The card lays the
  // whyLine and the macro caption out as plain flex-column siblings
  // (the only absolutely-positioned element is the skip × button), so
  // they cannot overlap. These tests pin that structure so a future
  // refactor can't reintroduce an overlap. Web renders the whyLine as
  // a clamp-to-2-lines-equivalent <button>; mobile uses <Text
  // numberOfLines={1}> — both flow in the same column.
  const suggestionWithWhyLine: NorthStarBlockSuggestion = {
    ...baseSuggestion,
    whyLine: "Fits your remaining 740 kcal",
  };

  it("renders the whyLine and the macro caption as two distinct elements", () => {
    render(<NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />);
    const whyLine = screen.getByRole("button", {
      name: /Fits your remaining 740 kcal/,
    });
    const macro = screen.getByText(/520 kcal · 38g P · 42g C · 18g F/);
    expect(whyLine).toBeDefined();
    expect(macro).toBeDefined();
    expect(whyLine).not.toBe(macro);
    // The macro row is not nested inside the whyLine button (and vice
    // versa) — they are independent nodes.
    expect(whyLine.contains(macro)).toBe(false);
    expect(macro.contains(whyLine)).toBe(false);
  });

  it("keeps the whyLine in normal flow (not absolutely positioned)", () => {
    render(<NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />);
    const whyLine = screen.getByRole("button", {
      name: /Fits your remaining 740 kcal/,
    });
    const macro = screen.getByText(/520 kcal · 38g P · 42g C · 18g F/);
    // The only `absolute` element in the card is the skip button. If
    // the whyLine or macro row picked up `absolute` it could lift out
    // of column flow and stack over a sibling — the reported failure.
    expect(whyLine.className).not.toMatch(/\babsolute\b/);
    expect(macro.className).not.toMatch(/\babsolute\b/);
    // The macro row's wrapping flex container must not be absolute
    // either.
    const macroRow = macro.parentElement;
    expect(macroRow?.className ?? "").not.toMatch(/\babsolute\b/);
  });

  it("stacks the whyLine BEFORE the macro row in document order", () => {
    render(<NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />);
    const whyLine = screen.getByRole("button", {
      name: /Fits your remaining 740 kcal/,
    });
    const macro = screen.getByText(/520 kcal · 38g P · 42g C · 18g F/);
    // In normal flow, DOM order is paint/stack order. whyLine must
    // precede the macro row so they read top-to-bottom, never overlaid.
    const order = whyLine.compareDocumentPosition(macro);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the whyLine exactly once (no duplicate stacked subtitle)", () => {
    render(<NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />);
    expect(
      screen.getAllByRole("button", { name: /Fits your remaining 740 kcal/ }),
    ).toHaveLength(1);
  });
});

describe("NorthStarBlock (web) — non-default kinds", () => {
  it("library-empty: renders invitation + 'Open Library →' button", () => {
    const onOpenLibrary = vi.fn();
    render(<NorthStarBlock kind="library-empty" onOpenLibrary={onOpenLibrary} />);
    expect(
      screen.getByText(/Pick a few recipes you'd actually cook/),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Open Library →" }));
    expect(onOpenLibrary).toHaveBeenCalled();
  });

  it("over-budget: renders the calm caption only (no card, no CTA)", () => {
    render(<NorthStarBlock kind="over-budget" />);
    expect(
      screen.getByText(
        /You've hit your calories for today — eat freely, or save for tomorrow\./,
      ),
    ).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("no-fit: renders the caption + Browse text button", () => {
    const onBrowse = vi.fn();
    render(<NorthStarBlock kind="no-fit" onBrowse={onBrowse} />);
    expect(
      screen.getByText(/Library has nothing under your remaining macros today\./),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Browse →" }));
    expect(onBrowse).toHaveBeenCalled();
  });

  it("default kind without suggestion renders nothing (defensive)", () => {
    const { container } = render(<NorthStarBlock kind="default" />);
    expect(container.firstChild).toBeNull();
  });
});
