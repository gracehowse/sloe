import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DigestStoryCard } from "./digest-story-card";

const meta = {
  title: "Suppr/DigestStoryCard",
  component: DigestStoryCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Always-visible weekly narrative card on Progress — calm factual story, not a stat grid.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    weekLabel: "14–20 Jul",
    daysLogged: 6,
    avgCalories: 2040,
    targetCalories: 2100,
    avgProtein: 128,
    targetProtein: 130,
    proteinOnTargetDays: 4,
    closestToTarget: {
      label: "Wednesday",
      calories: 2080,
      protein: 135,
    },
    dayOfWeekPattern: {
      highDay: "Saturday",
      lowDay: "Tuesday",
      deltaKcal: 250,
    },
  },
} satisfies Meta<typeof DigestStoryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithStory: Story = {};

export const EmptyWeek: Story = {
  args: {
    daysLogged: 0,
    avgCalories: 0,
    targetCalories: 2100,
    avgProtein: 0,
    targetProtein: 130,
    proteinOnTargetDays: 0,
    closestToTarget: null,
    dayOfWeekPattern: null,
  },
};
