import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { CookbookImportReview } from "./CookbookImportReview";
import { STORY_COOKBOOK_RECIPES } from "./_storyFixtures";

function CookbookImportReviewDemo(
  props: Omit<
    ComponentProps<typeof CookbookImportReview>,
    "excludedKeys" | "onToggle" | "setNutritionMode" | "nutritionMode" | "selectedCount"
  > & {
    initialExcluded?: string[];
    initialMode?: "author" | "match";
  },
) {
  const { initialExcluded = [], initialMode = "match", ...rest } = props;
  const [excludedKeys, setExcludedKeys] = useState(() => new Set(initialExcluded));
  const [nutritionMode, setNutritionMode] = useState<"author" | "match">(initialMode);
  const selectedCount = rest.recipes.length - excludedKeys.size;

  return (
    <CookbookImportReview
      {...rest}
      excludedKeys={excludedKeys}
      nutritionMode={nutritionMode}
      selectedCount={selectedCount}
      setNutritionMode={setNutritionMode}
      onToggle={(key) => {
        setExcludedKeys((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      }}
    />
  );
}

const meta = {
  title: "Suppr/CookbookImport/CookbookImportReview",
  component: CookbookImportReviewDemo,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    bookName: "Fast 800 Collection",
    recipes: STORY_COOKBOOK_RECIPES,
    parseWarnings: [],
    pickError: null,
    committing: false,
    onBack: () => {},
    onSave: () => {},
  },
} satisfies Meta<typeof CookbookImportReviewDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };

export const WithWarningsAndError: Story = {
  args: {
    parseWarnings: ["low_confidence_rows"],
    pickError: "Couldn't read one recipe — try again.",
    initialExcluded: ["r2"],
  },
};

export const Committing: Story = {
  args: {
    committing: true,
  },
};
