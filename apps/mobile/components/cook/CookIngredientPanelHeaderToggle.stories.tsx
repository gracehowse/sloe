import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookIngredientPanelHeaderToggle } from "./CookIngredientPanelHeaderToggle";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Cook/CookIngredientPanelHeaderToggle",
  component: CookIngredientPanelHeaderToggle,
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
  args: { open: false, onOpen: () => undefined, accentInk: "#3B2A4D" },
} satisfies Meta<typeof CookIngredientPanelHeaderToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed = {} as Story;
export const Open: Story = { args: { open: true } };
