import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TodayAppleHealthCard } from "./today-apple-health-card";

const meta = {
  title: "Suppr/TodayAppleHealthCard",
  component: TodayAppleHealthCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 300, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TodayAppleHealthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullSync: Story = {
  args: {
    stepsForSelectedDay: 8432,
    activeEnergyKcal: 412,
    restingBurnKcal: 1580,
    latestWeightKg: 72.4,
    useImperial: false,
  },
};

export const PartialData: Story = {
  name: "Partial (steps only)",
  args: {
    stepsForSelectedDay: 5200,
    activeEnergyKcal: null,
    restingBurnKcal: null,
    latestWeightKg: null,
  },
};
