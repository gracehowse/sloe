import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecipesTabChrome } from "./recipes-tab-chrome";

const meta = {
  title: "Suppr/RecipesTabChrome",
  component: RecipesTabChrome,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Sticky Cook / Your kitchen mobile-web header with Cookbook / Discover sub-tabs.",
      },
    },
  },
  args: {
    onSelect: () => undefined,
  },
} satisfies Meta<typeof RecipesTabChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cookbook: Story = {
  args: { activeId: "library" },
};

export const Discover: Story = {
  args: { activeId: "discover" },
};
