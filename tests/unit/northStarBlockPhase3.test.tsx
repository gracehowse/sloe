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
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  NorthStarBlock,
  type NorthStarBlockSuggestion,
} from "../../src/app/components/suppr/north-star-block";

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

describe("NorthStarBlock (web) — default kind", () => {
  it("renders the eyebrow, title, band chip and macro caption", () => {
    render(<NorthStarBlock kind="default" suggestion={baseSuggestion} ctaLabel="Log it" />);
    expect(screen.getByText("What to eat next")).toBeDefined();
    expect(screen.getByText("Tofu poke bowl")).toBeDefined();
    expect(screen.getByText("Hits within 3%")).toBeDefined();
    // 2026-05-12 (premium-bar audit cross-cutting): macro format
    // unified to `520 kcal · 38g P · 42g C · 18g F` across Today
    // surfaces (NorthStarBlock + EatAgain). Was slash-separated
    // `38P / 42C / 18F`.
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

  it("uses the placeholder gradient when thumbnail is absent", () => {
    render(<NorthStarBlock kind="default" suggestion={baseSuggestion} />);
    // No img element when thumbnail is undefined.
    expect(screen.queryByRole("img")).toBeNull();
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
