import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProfileShowcaseReadView } from "./ProfileShowcaseReadView";

const meta = {
  title: "Suppr/Profile/ProfileShowcaseReadView",
  component: ProfileShowcaseReadView,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    displayName: "Grace",
    joinedLabel: "Joined 2mo ago",
    monogramInitial: "G",
    recipeCount: 14,
    streakDays: 5,
    daysLogged: 42,
    calories: "1,850",
    protein: "130",
    carbs: "180",
    fat: "62",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 390 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProfileShowcaseReadView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const FreshAccount: Story = {
  args: {
    displayName: "",
    joinedLabel: "Joined this week",
    monogramInitial: "S",
    recipeCount: 0,
    streakDays: 0,
    daysLogged: 1,
    calories: "2,000",
    protein: "150",
    carbs: "200",
    fat: "65",
  },
};
