import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SwipeDeleteRow } from "./swipe-delete-row";

const meta = {
  component: SwipeDeleteRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Swipe-left (or drag) to reveal a destructive Remove action. Mirrors mobile shopping/meal swipe rows. Set `enabled={false}` to pass through children only.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm overflow-hidden rounded-xl border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SwipeDeleteRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDelete: () => undefined,
    children: (
      <div className="px-4 py-3 text-sm">
        <p className="font-medium">Greek yogurt bowl</p>
        <p className="text-muted-foreground">420 kcal · swipe left to remove</p>
      </div>
    ),
  },
};

export const Disabled: Story = {
  args: {
    enabled: false,
    onDelete: () => undefined,
    children: (
      <div className="px-4 py-3 text-sm">
        <p className="font-medium">Locked row</p>
        <p className="text-muted-foreground">Swipe disabled</p>
      </div>
    ),
  },
};
