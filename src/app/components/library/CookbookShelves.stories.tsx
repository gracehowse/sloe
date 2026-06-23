import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { RecipeCard } from "@/types/recipe";
import { deriveLibraryShelves } from "@/lib/recipes/libraryShelves";
import { FeaturedHero } from "./FeaturedHero";
import { EditorialShelf } from "./EditorialShelf";

/**
 * Cookbook editorial shelves — the Sloe v3 Cookbook header (web parity of the
 * SEE-validated mobile components, ENG-1225 Block 5). Pins the FeaturedHero
 * "Tonight's pick" card above two derived EditorialShelves (Fits your day /
 * Quick) in the mobile-web single column.
 */
const rc = (
  id: string,
  title: string,
  o: Partial<RecipeCard> = {},
): RecipeCard =>
  ({
    id,
    title,
    image: "",
    creatorName: "",
    creatorImage: "",
    servings: 1,
    calories: 480,
    protein: 30,
    carbs: 42,
    fat: 16,
    isVerified: false,
    savedCount: 0,
    isSaved: false,
    prepTimeMin: 10,
    cookTimeMin: 15,
    ...o,
  }) as RecipeCard;

// A realistic mixed library: fits-your-day, quick, high-protein, and a couple
// that miss every shelf (so the derivation has to drop them).
const library: RecipeCard[] = [
  rc("r1", "Tahini grain bowl", { calories: 520, protein: 28, prepTimeMin: 10, cookTimeMin: 15 }),
  rc("r2", "Miso salmon traybake", { calories: 560, protein: 38, prepTimeMin: 10, cookTimeMin: 20 }),
  rc("r3", "Greek yoghurt & berries", { calories: 280, protein: 24, prepTimeMin: 5, cookTimeMin: 0 }),
  rc("r4", "Harissa chickpea stew", { calories: 430, protein: 19, prepTimeMin: 10, cookTimeMin: 25 }),
  rc("r5", "Steak & charred greens", { calories: 640, protein: 46, prepTimeMin: 5, cookTimeMin: 18 }),
  rc("r6", "Five-minute egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 2 }),
  rc("r7", "Slow lamb shoulder", { calories: 820, protein: 52, prepTimeMin: 20, cookTimeMin: 180 }),
  rc("r8", "Mystery import", { calories: 0, protein: 0, prepTimeMin: null, cookTimeMin: null }),
];

const shelves = deriveLibraryShelves(library);
const featured = shelves[0]?.recipes[0] ?? library[0];

function CookbookShelvesPreview() {
  return (
    <>
      <FeaturedHero recipe={featured} onPress={() => {}} />
      {shelves.slice(0, 2).map((sh) => (
        <EditorialShelf
          key={sh.key}
          title={sh.title}
          subtitle={sh.subtitle}
          recipes={sh.recipes}
          onPressRecipe={() => {}}
        />
      ))}
    </>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 390,
        background: "var(--background)",
        padding: 20,
        borderRadius: 24,
      }}
    >
      {children}
    </div>
  );
}

const meta = {
  title: "Library/CookbookShelves",
  component: CookbookShelvesPreview,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <Frame>
        <Story />
      </Frame>
    ),
  ],
} satisfies Meta<typeof CookbookShelvesPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Hero + shelves",
};
