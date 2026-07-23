import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { RecipeActionPills } from "./RecipeActionPills";

const meta = {
  title: "Mobile/Recipe/RecipeActionPills",
  component: RecipeActionPills,
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
    onLog: () => undefined,
    logging: false,
    onEdit: () => undefined,
  },
} satisfies Meta<typeof RecipeActionPills>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLogAndEdit: Story = {
  name: "Log + edit (legacy)",
};

export const EditOnly: Story = {
  name: "Edit only (v3 conformance)",
  args: { showLog: false },
};

export const Logging: Story = {
  args: { logging: true },
};
