import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanTabChrome } from "./plan-tab-chrome";

const meta = {
  title: "Suppr/PlanTabChrome",
  component: PlanTabChrome,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Sticky Plan mobile-web header with This week / Shopping sub-tabs.",
      },
    },
  },
  args: {
    onSelect: () => undefined,
  },
} satisfies Meta<typeof PlanTabChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThisWeek: Story = {
  args: {
    activeId: "plan",
    subtitle: "14–20 Jul",
  },
};

export const ShoppingWithBadge: Story = {
  name: "Shopping (unchecked badge)",
  args: {
    activeId: "shopping",
    shoppingUncheckedCount: 7,
    subtitle: "14–20 Jul",
  },
};
