import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { TodayCompleteDayModal } from "./TodayCompleteDayModal";

const c = Colors.light;
const noop = () => undefined;

const meta = {
  title: "Mobile/Today/TodayCompleteDayModal",
  component: TodayCompleteDayModal,
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
  args: {
    visible: true,
    onClose: noop,
    isToday: true,
    profileWeightKg: 70,
    todayCalories: 1600,
    targetCalories: 2000,
    todayProteinG: 90,
    proteinTargetG: 130,
    maintenanceTdeeKcal: 2200,
    profileGoal: "lose",
    onViewProgress: noop,
    cardColor: c.card,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    borderColor: c.border,
  },
} satisfies Meta<typeof TodayCompleteDayModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TodayComplete: Story = {};

export const HistoricDay: Story = { args: { isToday: false } };
