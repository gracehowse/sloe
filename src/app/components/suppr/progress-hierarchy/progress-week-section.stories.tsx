import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressWeekSection } from "./progress-week-section";
import { hierarchyWeekDays } from "./_storyFixtures";

const meta = {
  title: "Suppr/ProgressHierarchy/ProgressWeekSection",
  component: ProgressWeekSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "§2 This week — adherence headline, Mon–Sun bars, macro rows, streak microrow.",
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
} satisfies Meta<typeof ProgressWeekSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrackWeek: Story = {
  name: "On-target week",
  args: {
    adherencePct: 82,
    onTargetCount: 5,
    days: hierarchyWeekDays,
    todayKey: "2026-07-12",
    macros: [
      { name: "Protein", pct: 92, color: "var(--macro-protein)" },
      { name: "Carbs", pct: 88, color: "var(--macro-carbs)" },
      { name: "Fat", pct: 104, color: "var(--macro-fat)" },
      { name: "Fibre", pct: 71, color: "var(--macro-fibre)" },
    ],
    streakDays: 4,
    freezesAvailable: 1,
    onOpenStreak: () => undefined,
  },
};

export const OvershootAdherence: Story = {
  name: "Overshoot adherence (>110%)",
  args: {
    adherencePct: 118,
    onTargetCount: 2,
    days: hierarchyWeekDays,
    todayKey: "2026-07-12",
    macros: [
      { name: "Protein", pct: 115, color: "var(--macro-protein)" },
      { name: "Carbs", pct: 122, color: "var(--macro-carbs)" },
      { name: "Fat", pct: 108, color: "var(--macro-fat)" },
      { name: "Fibre", pct: 90, color: "var(--macro-fibre)" },
    ],
    streakDays: 0,
    freezesAvailable: 0,
  },
};
