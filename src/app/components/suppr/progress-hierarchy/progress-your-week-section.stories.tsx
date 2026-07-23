import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressYourWeekSection } from "./progress-your-week-section";

const meta = {
  title: "Suppr/ProgressHierarchy/ProgressYourWeekSection",
  component: ProgressYourWeekSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "§5 Your week — serif verdict, one texture line, ghost share CTA.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressYourWeekSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UsualMealTexture: Story = {
  name: "Usual-meal texture",
  args: {
    weekKey: "2026-W28",
    weekLabel: "6–12 Jul",
    headline: "A steady week — protein carried you.",
    usualMeal: { name: "Overnight oats", count: 3 },
    bestDay: { label: "Friday", calories: 1500, protein: 96 },
    shareText: "My week on Sloe — 5 days logged.",
    shareDisabled: false,
    onShare: () => undefined,
  },
};

export const ShareDisabled: Story = {
  name: "Share disabled (empty week)",
  args: {
    weekKey: "2026-W28",
    weekLabel: "6–12 Jul",
    headline: "Log a few days to unlock your week story.",
    usualMeal: null,
    bestDay: null,
    shareText: "",
    shareDisabled: true,
  },
};
