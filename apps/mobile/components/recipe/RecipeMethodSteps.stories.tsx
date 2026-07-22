import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RecipeMethodSteps } from "./RecipeMethodSteps";

const STEPS = [
  "Preheat the oven to 200°C.",
  "Roast the vegetables for 25 minutes.",
  "Finish with herbs and serve.",
];

const meta = {
  title: "Mobile/Recipe/RecipeMethodSteps",
  component: RecipeMethodSteps,
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
  args: { steps: STEPS },
} satisfies Meta<typeof RecipeMethodSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;

export const Numbered: Story = {
  args: { variant: "numbered", stepCountNote: "3 steps" },
};
