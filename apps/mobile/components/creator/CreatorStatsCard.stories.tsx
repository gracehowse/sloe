import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { CreatorStatsCard } from "./CreatorStatsCard";

const meta = {
  title: "Mobile/Creator/CreatorStatsCard",
  component: CreatorStatsCard,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Recipes / Followers / Following counts as one flat hairline card with divided cells — the mobile half of the `creator_profile_v3` structural pass, matching the web CreatorStatsCard. Page-ground card grammar: border + fill, no shadow. Renders nothing when `creator_profile_v3` is off (the legacy inline stats line owns the numbers then); Storybook resolves the flag on.",
      },
    },
  },
  args: { recipeCount: 24, followerCount: 1200, followingCount: 0 },
} satisfies Meta<typeof CreatorStatsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An established creator — the common case. */
export const Default: Story = {};

/** First recipe published, a handful of followers. */
export const NewCreator: Story = {
  args: { recipeCount: 1, followerCount: 3, followingCount: 12 },
};

/** Nothing published yet — three zeros, cells still evenly divided. */
export const EmptyCreator: Story = {
  args: { recipeCount: 0, followerCount: 0, followingCount: 0 },
};

/** Wide numbers in every cell — checks the cells stay equal-width. */
export const LargeNumbers: Story = {
  args: { recipeCount: 348, followerCount: 128400, followingCount: 1024 },
};
