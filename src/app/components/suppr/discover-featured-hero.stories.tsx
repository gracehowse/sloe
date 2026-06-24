import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { RecipeCard } from "@/types/recipe";
import { DiscoverFeaturedHeroCard } from "./discover-featured-hero";

/**
 * DiscoverFeaturedHeroCard — the v3 Discover featured block (ENG-1225 #14, prototype
 * `.w-feat`). Desktop two-pane carded hero: photo + "Trending this week" eyebrow
 * + serif title + kcal/protein/min triad + creator byline + View recipe. The
 * component is `md:block` only, so the frame is desktop-width. Gated by the host
 * on `discover_creator_rail_v1`; this story renders it in isolation.
 */
const recipe: RecipeCard = {
  id: "demo-feat",
  creatorName: "Priya Patel",
  creatorImage: "",
  title: "Harissa chickpea stew with whipped feta",
  image:
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=70",
  servings: 4,
  calories: 540,
  protein: 31,
  carbs: 48,
  fat: 22,
  isVerified: false,
  savedCount: 0,
  isSaved: false,
  cookTimeMin: 35,
  creatorId: "seed-creator-priya",
} as RecipeCard;

const noPhoto: RecipeCard = {
  ...recipe,
  id: "demo-feat-nophoto",
  title: "Make-ahead high-protein traybake",
  image: "",
  creatorId: null,
  creatorName: "Theo Blake",
} as RecipeCard;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 880, background: "var(--background)", padding: 20 }}>
      {children}
    </div>
  );
}

const meta = {
  title: "Discover/DiscoverFeaturedHeroCard",
  component: DiscoverFeaturedHeroCard,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { recipe, onOpenRecipe: () => {}, onOpenCreator: () => {} },
} satisfies Meta<typeof DiscoverFeaturedHeroCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  name: "Desktop (photo + creator)",
  render: () => (
    <Frame>
      <DiscoverFeaturedHeroCard recipe={recipe} onOpenRecipe={() => {}} onOpenCreator={() => {}} />
    </Frame>
  ),
};

export const NoPhotoNoCreator: Story = {
  name: "No photo · no linked creator",
  render: () => (
    <Frame>
      <DiscoverFeaturedHeroCard recipe={noPhoto} onOpenRecipe={() => {}} />
    </Frame>
  ),
};
