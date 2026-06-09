// @vitest-environment jsdom
/**
 * <MacroIconRow> — the canonical at-a-glance macro row shared by the
 * Library card, Discover hero card, and the Today slot header.
 *
 * This test pins two behaviours the 2026-06-08 recipe-card pass added:
 *
 *   1. `emphasiseProtein` (recipes.md §3.1 — "one visual emphasis per
 *      card"): when on, the protein value renders heavier (fontWeight
 *      700) and in the supplied `proteinTextColor` ink, so the Library
 *      card reads as a tracker. Off by default — Today / Discover hero
 *      rows keep even weighting, so this can't silently bold protein
 *      everywhere.
 *
 *   2. kcal is rendered from a real number and SUPPRESSED when the
 *      caller passes `null` — so a recipe whose nutrition hasn't computed
 *      never shows a confident "0 kcal" on its card (trust posture / F4).
 *
 * If protein emphasis or kcal suppression regresses, the card stops
 * reading the way the spec requires — these break before that ships.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";

import { MacroIconRow } from "../../components/nutrition/MacroIconRow";

void React;

/** Flatten an RN style prop (object | array | nested) into one object. */
function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean).map(flatten));
  }
  return (style as Record<string, unknown>) ?? {};
}

const BASE = {
  textColor: "#857F8B",
  textTertiaryColor: "#9B93A3",
} as const;

describe("MacroIconRow — protein emphasis (recipes.md §3.1)", () => {
  it("renders protein heavier + in the emphasis ink when emphasiseProtein is on", () => {
    const { getByText } = render(
      <MacroIconRow
        kcal={520}
        protein={32}
        carbs={40}
        fat={18}
        showMacroLetters={false}
        emphasiseProtein
        proteinTextColor="#1B1814"
        {...BASE}
      />,
    );
    const protein = getByText("32g");
    const style = flatten(protein.props.style);
    expect(style.fontWeight).toBe("700");
    expect(style.color).toBe("#1B1814");
  });

  it("leaves protein at the row's normal weight + colour when emphasis is off (default)", () => {
    const { getByText } = render(
      <MacroIconRow kcal={520} protein={32} carbs={40} fat={18} showMacroLetters={false} {...BASE} />,
    );
    const protein = getByText("32g");
    const style = flatten(protein.props.style);
    // No 700 weight forced; ink is the shared row text colour.
    expect(style.fontWeight).not.toBe("700");
    expect(style.color).toBe(BASE.textColor);
  });

  it("does not bold carbs or fat even when protein is emphasised (single accent)", () => {
    const { getByText } = render(
      <MacroIconRow
        kcal={520}
        protein={32}
        carbs={40}
        fat={18}
        showMacroLetters={false}
        emphasiseProtein
        proteinTextColor="#1B1814"
        {...BASE}
      />,
    );
    expect(flatten(getByText("40g").props.style).fontWeight).not.toBe("700");
    expect(flatten(getByText("18g").props.style).fontWeight).not.toBe("700");
  });
});

describe("MacroIconRow — kcal suppression (trust posture / F4)", () => {
  it("shows kcal when a real positive number is passed", () => {
    const { getByText } = render(
      <MacroIconRow kcal={520} protein={32} carbs={40} fat={18} {...BASE} />,
    );
    expect(getByText("520 kcal")).toBeTruthy();
  });

  it("suppresses the kcal chunk entirely when kcal is null (un-computed recipe)", () => {
    const { queryByText } = render(
      <MacroIconRow kcal={null} protein={32} carbs={40} fat={18} showMacroLetters={false} {...BASE} />,
    );
    expect(queryByText(/kcal/)).toBeNull();
    // …but the macros the recipe DOES have still render.
    expect(queryByText("32g")).toBeTruthy();
  });
});
