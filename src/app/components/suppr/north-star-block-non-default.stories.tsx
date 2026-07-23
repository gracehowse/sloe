import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NorthStarBlockNonDefault } from "./north-star-block-non-default";

const meta = {
  title: "Suppr/NorthStarBlockNonDefault",
  component: NorthStarBlockNonDefault,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Non-default NorthStarBlock branches (over-budget, under-eating, new-user, library-empty, no-fit).",
      },
    },
  },
  args: {
    onOpenLibrary: () => undefined,
    onBrowse: () => undefined,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NorthStarBlockNonDefault>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewUser: Story = {
  args: { kind: "new-user" },
};

export const LibraryEmpty: Story = {
  args: { kind: "library-empty" },
};

export const NoFit: Story = {
  args: { kind: "no-fit" },
};

export const OverBudget: Story = {
  args: {
    kind: "over-budget",
    overBudgetStage: "over",
    overBudgetCalories: { consumed: 2350, goal: 2100 },
  },
};

export const UnderEating: Story = {
  args: {
    kind: "under-eating",
    underEatingLine: "You're under on protein — a Greek yoghurt snack would close the gap.",
  },
};
