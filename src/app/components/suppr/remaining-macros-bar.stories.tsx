import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RemainingMacrosBar } from "./remaining-macros-bar";

const TARGETS = {
  calories: 2100,
  protein: 140,
  carbs: 220,
  fat: 70,
  fiber: 30,
};

const meta = {
  title: "Suppr/RemainingMacrosBar",
  component: RemainingMacrosBar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Compact remaining kcal/macro row under DailyRing — optional after-candidate projection.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RemainingMacrosBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    targets: TARGETS,
    consumed: {
      calories: 980,
      protein: 62,
      carbs: 95,
      fat: 28,
      fiber: 12,
    },
  },
};

export const OverBudget: Story = {
  name: "Over budget",
  args: {
    targets: TARGETS,
    consumed: {
      calories: 2400,
      protein: 155,
      carbs: 260,
      fat: 85,
      fiber: 34,
    },
  },
};

export const WithCandidate: Story = {
  name: "With candidate preview",
  args: {
    targets: TARGETS,
    consumed: {
      calories: 980,
      protein: 62,
      carbs: 95,
      fat: 28,
      fiber: 12,
    },
    candidate: {
      calories: 420,
      protein: 35,
      carbs: 40,
      fat: 12,
      fiber: 6,
    },
  },
};
