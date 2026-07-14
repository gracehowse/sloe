// @vitest-environment jsdom
/**
 * Cookbook editorial shelves (ENG-1225 Block 5) — useLibraryShelves hook +
 * RecipeCardWide / EditorialShelf / FeaturedHero render. Pins the shelf
 * derivation, the card meta line, the shelf header, and the hero kicker/badge.
 */
import { describe, expect, it, vi } from "vitest";
import { StyleSheet, Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#6A6072",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    backgroundSecondary: "#F5F4F7",
    border: "#E8E2EC",
    card: "#FFFFFF",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));
vi.mock("@/components/library/RecipeCardImage", () => ({
  RecipeCardImage: () => null,
}));

import { useLibraryShelves } from "../../hooks/useLibraryShelves";
import { RecipeCardWide } from "../../components/library/RecipeCardWide";
import { EditorialShelf } from "../../components/library/EditorialShelf";
import { FeaturedHero } from "../../components/library/FeaturedHero";
import type { RecipeCard } from "../../lib/types";

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

function ShelfProbe({ recipes }: { recipes: RecipeCard[] }) {
  const shelves = useLibraryShelves(recipes);
  return <Text>{`keys:${shelves.map((s) => s.key).join(",")}|first:${shelves[0]?.recipes.map((r) => r.id).join(",") ?? ""}`}</Text>;
}

describe("useLibraryShelves", () => {
  it("returns the non-empty shelves for a filtered list", () => {
    // "a" qualifies for all three; "b" qualifies for none.
    const { getByText } = render(
      <ShelfProbe
        recipes={[rc("a"), rc("b", { calories: 1200, protein: 5, prepTimeMin: 60, cookTimeMin: 30 })]}
      />,
    );
    expect(getByText("keys:fits,quick,high-protein|first:a")).toBeTruthy();
  });
});

describe("RecipeCardWide", () => {
  it("renders name + kcal/protein/time meta and fires onPress", () => {
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <RecipeCardWide recipe={rc("Tahini bowl", { calories: 520, protein: 34 })} onPress={onPress} />,
    );
    expect(getByText("Tahini bowl")).toBeTruthy();
    expect(getByText("520 kcal · 34g protein · 20 min")).toBeTruthy();
    fireEvent.press(getByLabelText(/Tahini bowl/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows 'Nutrition pending' when calories are 0", () => {
    const { getByText } = render(
      <RecipeCardWide recipe={rc("Mystery", { calories: 0 })} onPress={() => {}} />,
    );
    expect(getByText(/Nutrition pending/)).toBeTruthy();
  });

  // Borderless + serif card grammar (Sloe v3, ratified 2026-06-23): the card
  // carries no border, and the name is the Newsreader serif (parity with the
  // grid + the web twin). Guards against a regression back to the bordered/sans
  // stopgap the Block 5 fidelity review flagged.
  it("uses the borderless + serif name grammar", () => {
    const { getByText, getByLabelText } = render(
      <RecipeCardWide recipe={rc("Tahini bowl")} onPress={() => {}} />,
    );
    const nameStyle = StyleSheet.flatten(getByText("Tahini bowl").props.style);
    expect(nameStyle.fontFamily).toMatch(/Newsreader/);
    const cardStyle = StyleSheet.flatten(getByLabelText(/Tahini bowl/).props.style);
    expect(cardStyle.borderWidth ?? 0).toBe(0);
  });
});

describe("EditorialShelf", () => {
  it("renders the title, subtitle, and a card per recipe", () => {
    const onPressRecipe = vi.fn();
    const { getByText, getByLabelText } = render(
      <EditorialShelf
        title="Fits your day"
        subtitle="Lands your protein, sits inside what's left"
        recipes={[rc("Oats"), rc("Soup")]}
        onPressRecipe={onPressRecipe}
      />,
    );
    expect(getByText("Fits your day")).toBeTruthy();
    expect(getByText("Lands your protein, sits inside what's left")).toBeTruthy();
    fireEvent.press(getByLabelText(/Soup/));
    expect(onPressRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: "Soup" }));
  });
});

describe("FeaturedHero", () => {
  it("renders the kick badge, kicker, title and meta", () => {
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <FeaturedHero recipe={rc("Miso salmon", { calories: 560, protein: 38, prepTimeMin: 10, cookTimeMin: 20 })} onPress={onPress} />,
    );
    expect(getByText("Tonight's pick")).toBeTruthy();
    expect(getByText("From your cookbook")).toBeTruthy();
    expect(getByText("Miso salmon")).toBeTruthy();
    expect(getByText("560 kcal · 38g protein · 30 min")).toBeTruthy();
    fireEvent.press(getByLabelText(/Tonight's pick: Miso salmon/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
