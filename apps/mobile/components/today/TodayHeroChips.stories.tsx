import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { StatusChip, TodayCoachChip } from "./TodayHeroChips";

const noop = () => undefined;

const meta = {
  title: "Mobile/Today/TodayHeroChips",
  component: StatusChip,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof StatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderBudget: Story = {
  args: { state: "under", overByKcal: 0, isDark: false },
};

export const OverBudget: Story = {
  args: { state: "over", overByKcal: 400, isDark: false, onPress: noop },
};

export const CoachChip: Story = {
  render: () => <TodayCoachChip onPress={noop} />,
};
