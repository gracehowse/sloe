import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { BatchCookSurface } from "./BatchCookSurface";

const noop = () => undefined;

const meta = {
  title: "Mobile/Plan/BatchCookSurface",
  component: BatchCookSurface,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA", minHeight: 640 }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  args: {
    recipes: [
      { id: "r1", title: "Chicken traybake", servings: 4, caloriesPerPortion: 520 },
      { id: "r2", title: "Lentil soup", servings: 6, caloriesPerPortion: 280 },
    ],
    onBack: noop,
    onSave: noop,
    onCook: noop,
  },
} satisfies Meta<typeof BatchCookSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecipePicker: Story = {};

export const SingleRecipe: Story = {
  args: {
    recipes: [{ id: "r1", title: "Chicken traybake", servings: 4, caloriesPerPortion: 520 }],
  },
};
