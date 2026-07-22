import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { NorthStarBlockSuggestion } from "./NorthStarBlock";
const suggestion: NorthStarBlockSuggestion = {
  recipeId: "r-salmon-bowl", title: "Miso salmon rice bowl", predictedCalories: 642, predictedProtein: 41,
  predictedCarbs: 58, predictedFat: 22, bandLabel: "Close fit", bandTight: true,
  whyLine: "Closes your remaining protein for today", cookTimeMin: 25,
};

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { NorthStarBlock } from "./NorthStarBlock";

const meta = {
  title: "Mobile/Today/NorthStarBlock",
  component: NorthStarBlock,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: { kind: "default", suggestion, onPrimaryCta: noop, onSkip: noop, onLogCta: noop },
} satisfies Meta<typeof NorthStarBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultSuggestion: Story = {};
export const NoFit: Story = { args: { kind: "no-fit", suggestion: undefined, onBrowse: noop } };
