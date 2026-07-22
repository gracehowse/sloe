import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IngredientInfoSheet } from "./IngredientInfoSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Recipe/IngredientInfoSheet",
  component: IngredientInfoSheet,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={ { width: 360, padding: 16, background: "#F7F6FA" } }>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: { onClose: () => undefined, info: {
      name: "Pecorino Romano",
      tierLabel: "Verified",
      tierColor: "#6B9080",
      confidencePct: null,
      sourceLabel: "FatSecret",
      calories: 200,
      protein: 12,
      carbs: 2,
      fat: 16,
      explanation: "Matched to a branded cheese entry and scaled to your recipe.",
    } },
} satisfies Meta<typeof IngredientInfoSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified = {} as Story;
export const NeedsReview: Story = { args: { info: { ...{
      name: "Pecorino Romano",
      tierLabel: "Verified",
      tierColor: "#6B9080",
      confidencePct: null,
      sourceLabel: "FatSecret",
      calories: 200,
      protein: 12,
      carbs: 2,
      fat: 16,
      explanation: "Matched to a branded cheese entry and scaled to your recipe.",
    }, name: "Chickpeas", tierLabel: "Estimated", confidencePct: 62 }, onVerify: () => undefined } };
