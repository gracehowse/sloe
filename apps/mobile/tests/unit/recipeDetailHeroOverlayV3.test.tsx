// @vitest-environment jsdom
/**
 * RecipeDetail v3 hero overlay (ENG-1247, flag recipe_detail_v3). The prototype
 * `.rd-title` overlays the title block ON the hero photo (kicker overline +
 * serif h1 + meta row over a veil) instead of below it. Guards the flag-gated
 * restructure: the hero renders the overlay branch; the title block can hide its
 * title; the route wires both + suppresses the below-hero meta row when v3 is on.
 */
import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { RecipeTitleBlock } from "../../components/recipe/RecipeTitleBlock";

void React;

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", "..", rel), "utf8");

describe("RecipeTitleBlock — hideTitle (title moves into the hero overlay)", () => {
  const baseProps = { attribution: null, verdict: null, onNavigate: () => {} } as const;

  it("renders the serif title by default", () => {
    const { queryByText } = render(<RecipeTitleBlock title="Crispy gochujang tofu bowl" {...baseProps} />);
    expect(queryByText("Crispy gochujang tofu bowl")).toBeTruthy();
  });

  it("hides the title when hideTitle is set", () => {
    const { queryByText } = render(
      <RecipeTitleBlock title="Crispy gochujang tofu bowl" hideTitle {...baseProps} />,
    );
    expect(queryByText("Crispy gochujang tofu bowl")).toBeNull();
  });
});

describe("RecipeDetail v3 hero-overlay source pins", () => {
  const hero = read("components/recipe/RecipeDetailHero.tsx");
  const route = read("app/recipe/[id].tsx");

  it("the hero renders the flag-gated overlay branch (veil + kicker + serif title + meta)", () => {
    expect(hero).toMatch(/heroOverlay \?/); // flag-gated branch
    expect(hero).toMatch(/recipe-hero-veil/); // bottom veil gradient
    expect(hero).toMatch(/FontFamily\.serifMedium/); // serif h1
    expect(hero).toMatch(/\{kicker\}/); // kicker overline
    // meta row icons
    expect(hero).toMatch(/Clock|Flame|Utensils/);
  });

  it("the route wires heroOverlay + hideTitle + suppresses the below-hero meta row on v3", () => {
    expect(route).toMatch(/const recipeDetailV3 = isFeatureEnabled\("recipe_detail_v3"\)/);
    expect(route).toMatch(/heroOverlay=\{recipeDetailV3\}/);
    expect(route).toMatch(/hideTitle=\{recipeDetailV3\}/);
    // the below-hero RecipeMetaRow is gated off when the hero carries the meta
    expect(route).toMatch(/recipeDetailV3 \? null : <RecipeMetaRow/);
  });
});
