import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { CreatorGoPublicPromo } from "./CreatorGoPublicPromo";
import { CreatorStatsCard } from "./CreatorStatsCard";

const meta = {
  title: "Mobile/Creator/CreatorGoPublicPromo",
  component: CreatorGoPublicPromo,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Shown on your OWN creator profile when nothing is published yet: a flat hairline card with a soft-tinted sparkles glyph, one line of promise, and a ghost 'Go public' pill routing to /create-recipe. Ghost, not filled — the screen's one filled CTA belongs to the create flow itself. Gated on `creator_profile_v3` (default ON; Storybook resolves it on).",
      },
    },
  },
} satisfies Meta<typeof CreatorGoPublicPromo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The card on its own. */
export const Default: Story = {};

/** As it actually lands on an empty own-profile — directly under the stats card,
 *  so the two hairline cards read as one stack rather than two treatments. */
export const UnderStatsCard: Story = {
  decorators: [
    (Story) => (
      <>
        <CreatorStatsCard recipeCount={0} followerCount={0} followingCount={4} />
        <Story />
      </>
    ),
  ],
};
