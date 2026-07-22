import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookMiseEnPlace } from "./CookMiseEnPlace";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookMiseEnPlace",
  component: CookMiseEnPlace,
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
  args: { recipeId: "story-carbonara", recipeTitle: "Weeknight carbonara", items: [{ name: "Spaghetti", amountLabel: "400 g" }], onContinueToSteps: () => undefined },
} satisfies Meta<typeof CookMiseEnPlace>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Untitled: Story = { args: { recipeTitle: undefined } };
