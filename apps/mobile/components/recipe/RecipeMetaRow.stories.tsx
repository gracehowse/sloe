import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RecipeMetaRow } from "./RecipeMetaRow";

const meta = {
  title: "Mobile/Recipe/RecipeMetaRow",
  component: RecipeMetaRow,
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
    stats: [
      { key: "time", label: "20 min" },
      { key: "items", label: "10 items" },
    ],
  },
} satisfies Meta<typeof RecipeMetaRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;

export const TimeOnly: Story = {
  args: { stats: [{ key: "time", label: "35 min" }] },
};
