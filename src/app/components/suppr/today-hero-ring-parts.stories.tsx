import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  HeroCoachChip,
  HeroStatusChip,
  RingStatCell,
  RingStatusLine,
} from "./today-hero-ring-parts";

const noop = () => undefined;

const meta = {
  title: "Suppr/TodayHeroRingParts",
  component: HeroStatusChip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Presentational hero ring fragments — status chip, coach chip, ring status line, and stat cells (ENG-1247 / ENG-1293).",
      },
    },
  },
} satisfies Meta<typeof HeroStatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StatusUnder: Story = {
  args: { state: "under" },
};

export const StatusOverPressable: Story = {
  args: { state: "over", onPress: noop },
};

export const CoachChip: Story = {
  args: { state: "under" },
  render: () => <HeroCoachChip onPress={noop} />,
};

export const RingLineUnder: Story = {
  args: { state: "under" },
  render: () => <RingStatusLine state="under" />,
};

export const StatRow: Story = {
  args: { state: "under" },
  render: () => (
    <div className="flex w-[360px]">
      <RingStatCell label="Goal" value="2,000" />
      <RingStatCell label="Eaten" value="1,240" divider />
      <RingStatCell label="Remaining" value="760" divider />
    </div>
  ),
};
