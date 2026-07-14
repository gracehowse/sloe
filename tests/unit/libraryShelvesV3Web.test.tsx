// @vitest-environment jsdom
/**
 * Cookbook editorial shelves (ENG-1225 Block 5) — WEB parity render tests.
 *
 * Mirrors `apps/mobile/tests/unit/libraryShelvesV3.test.tsx`:
 *   - RecipeCardWide: card name + "{kcal} kcal · {p}g protein · {t} min" meta, the
 *     "Nutrition pending" fallback when calories are 0, and onPress.
 *   - EditorialShelf: section head title + subtitle + a card per recipe + tap.
 *   - FeaturedHero: kick badge / "From your cookbook" kicker / serif title / meta.
 *   - LibraryShelvesHeader: renders the hero + shelves on the All filter, and
 *     returns null when the category is not "all".
 *
 * ENG-1356 (flag-collapse sweep, 2026-07-06): `sloe_v3_editorial_shelves` was
 * always-on in production (REDESIGN_DEFAULT_ON) and is now collapsed —
 * LibraryShelvesHeader no longer reads it, so the "flag off" test this file
 * used to pin was removed rather than kept alive against dead code.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RecipeCardWide } from "../../src/app/components/library/RecipeCardWide";
import { EditorialShelf } from "../../src/app/components/library/EditorialShelf";
import { FeaturedHero } from "../../src/app/components/library/FeaturedHero";
import { LibraryShelvesHeader } from "../../src/app/components/library/LibraryShelvesHeader";
import type { RecipeCard } from "../../src/types/recipe";

void React;

const rc = (id: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title: id,
    image: "",
    creatorName: "",
    creatorImage: "",
    servings: 1,
    calories: 450,
    protein: 30,
    carbs: 40,
    fat: 12,
    isVerified: false,
    savedCount: 0,
    isSaved: false,
    prepTimeMin: 10,
    cookTimeMin: 10,
    ...o,
  }) as RecipeCard;

describe("RecipeCardWide (web)", () => {
  it("renders name + kcal/protein/time meta and fires onPress", () => {
    const onPress = vi.fn();
    render(
      <RecipeCardWide
        recipe={rc("Tahini bowl", { calories: 520, protein: 34 })}
        onPress={onPress}
      />,
    );
    expect(screen.getByText("Tahini bowl")).toBeTruthy();
    expect(screen.getByText("520 kcal · 34g protein · 20 min")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Tahini bowl/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows 'Nutrition pending' when calories are 0", () => {
    render(<RecipeCardWide recipe={rc("Mystery", { calories: 0 })} onPress={() => {}} />);
    expect(screen.getByText(/Nutrition pending/)).toBeTruthy();
  });

  // Borderless + serif card grammar (Sloe v3, ratified 2026-06-23): the name is
  // the Newsreader serif (var(--font-headline)) and the card carries no border —
  // parity with the mobile twin + the grid. Guards against a regression to the
  // bordered/sans stopgap the Block 5 fidelity review flagged.
  it("uses the borderless + serif name grammar", () => {
    render(<RecipeCardWide recipe={rc("Tahini bowl")} onPress={() => {}} />);
    expect(screen.getByText("Tahini bowl").className).toContain("var(--font-headline)");
    expect(screen.getByLabelText(/Tahini bowl/).className).not.toMatch(/border/);
  });
});

describe("EditorialShelf (web)", () => {
  it("renders the title, subtitle, and a card per recipe", () => {
    const onPressRecipe = vi.fn();
    render(
      <EditorialShelf
        title="Fits your day"
        subtitle="Lands your protein, sits inside what's left"
        recipes={[rc("Oats"), rc("Soup")]}
        onPressRecipe={onPressRecipe}
      />,
    );
    expect(screen.getByText("Fits your day")).toBeTruthy();
    expect(
      screen.getByText("Lands your protein, sits inside what's left"),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Soup/));
    expect(onPressRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Soup" }),
    );
  });
});

describe("FeaturedHero (web)", () => {
  it("renders the kick badge, kicker, title and meta", () => {
    const onPress = vi.fn();
    render(
      <FeaturedHero
        recipe={rc("Miso salmon", {
          calories: 560,
          protein: 38,
          prepTimeMin: 10,
          cookTimeMin: 20,
        })}
        onPress={onPress}
      />,
    );
    expect(screen.getByText("Tonight's pick")).toBeTruthy();
    expect(screen.getByText("From your cookbook")).toBeTruthy();
    expect(screen.getByText("Miso salmon")).toBeTruthy();
    expect(screen.getByText("560 kcal · 38g protein · 30 min")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Tonight's pick: Miso salmon/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe("LibraryShelvesHeader (web)", () => {
  it("renders the hero + shelves on the All filter", () => {
    render(
      <LibraryShelvesHeader
        filtered={[rc("Tahini bowl"), rc("Miso salmon", { calories: 560, protein: 38 })]}
        category="all"
        onPressRecipe={() => {}}
      />,
    );
    // Hero "Tonight's pick" + the first derived shelf head ("Fits your day").
    expect(screen.getByText("From your cookbook")).toBeTruthy();
    expect(screen.getByText("Fits your day")).toBeTruthy();
  });

  it("returns null when the category is not 'all'", () => {
    const { container } = render(
      <LibraryShelvesHeader
        filtered={[rc("Tahini bowl")]}
        category="saved"
        onPressRecipe={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
