import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  NorthStarFigmaHeroBlock,
} from "./north-star-figma-hero";
import type { NorthStarBlockSuggestion } from "./north-star-block";

const SUGGESTION: NorthStarBlockSuggestion = {
  recipeId: "r-salmon-bowl",
  title: "Miso salmon rice bowl",
  thumbnail: "/imagery/fallbacks/samples/roast-chicken.png",
  predictedCalories: 642,
  predictedProtein: 41,
  predictedCarbs: 58,
  predictedFat: 22,
  bandLabel: "Close fit",
  bandTight: true,
  prepTimeMin: 10,
  cookTimeMin: 18,
  isVerified: true,
};

const meta = {
  title: "Suppr/NorthStarFigmaHero",
  component: NorthStarFigmaHeroBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Figma 654 full-bleed What to eat next hero with on-image Log action.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    suggestion: SUGGESTION,
    slotEyebrow: "Dinner suggestion",
    onPrimaryCta: () => undefined,
    onSkip: () => undefined,
    onLogCta: () => undefined,
  },
} satisfies Meta<typeof NorthStarFigmaHeroBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithThumbnail: Story = {};

export const FallbackHero: Story = {
  args: {
    suggestion: {
      ...SUGGESTION,
      thumbnail: null,
      bandTight: false,
      bandLabel: "Room to spare",
      isVerified: false,
    },
  },
};
