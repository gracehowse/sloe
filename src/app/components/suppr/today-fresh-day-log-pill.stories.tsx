import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayFreshDayLogPill } from "./today-fresh-day-log-pill";

const meta = {
  title: "Suppr/TodayFreshDayLogPill",
  component: TodayFreshDayLogPill,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    onPress: () => undefined,
  },
} satisfies Meta<typeof TodayFreshDayLogPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Morning: Story = {
  name: "Morning (breakfast label)",
  args: { hour: 8 },
};

export const Evening: Story = {
  name: "Evening (dinner label)",
  args: { hour: 19 },
};
