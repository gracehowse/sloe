import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RecipeMacroStrip } from "./RecipeMacroStrip";

const meta = {
  title: "Mobile/Recipe/RecipeMacroStrip",
  component: RecipeMacroStrip,
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
  args: {
    cells: [
      { label: "Calories", value: "420" },
      { label: "Protein", value: "32g" },
      { label: "Carbs", value: "18g" },
      { label: "Fat", value: "14g" },
    ],
  },
} satisfies Meta<typeof RecipeMacroStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;

export const Compact: Story = {
  args: { variant: "compact" },
};
