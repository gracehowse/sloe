import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { NorthStarBlockSuggestion } from "./NorthStarBlock";
const suggestion: NorthStarBlockSuggestion = {
  recipeId: "r-salmon-bowl", title: "Miso salmon rice bowl", predictedCalories: 642, predictedProtein: 41,
  predictedCarbs: 58, predictedFat: 22, bandLabel: "Close fit", bandTight: true, cookTimeMin: 25,
};

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { NorthStarFigmaHero } from "./NorthStarFigmaHero";

const meta = {
  title: "Mobile/Today/NorthStarFigmaHero",
  component: NorthStarFigmaHero,
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
  args: { suggestion, slotEyebrow: "Dinner suggestion", onPrimaryCta: noop, onSkip: noop, onLogCta: noop },
} satisfies Meta<typeof NorthStarFigmaHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSuggestion: Story = {};
export const CompactLog: Story = { args: { onLogCta: noop } };
