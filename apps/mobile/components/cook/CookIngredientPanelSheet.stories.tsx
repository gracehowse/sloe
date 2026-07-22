import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookIngredientPanelSheet } from "./CookIngredientPanelSheet";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookIngredientPanelSheet",
  component: CookIngredientPanelSheet,
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
  args: { visible: true, recipeId: "story-recipe-1", items: [{ name: "Garlic", amountLabel: "2 cloves" }], onClose: () => undefined },
} satisfies Meta<typeof CookIngredientPanelSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open = {} as Story;
export const Hidden: Story = { args: { visible: false } };
