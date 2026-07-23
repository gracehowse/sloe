import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
import type { WeeklyCheckinContent } from "@/lib/weeklyCheckin";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { WeeklyCheckinModal } from "./WeeklyCheckinModal";

const c = Colors.light;
const noop = () => undefined;

const content: WeeklyCheckinContent = {
  tdeeDeltaKcal: -120,
  suggestedTargetKcal: 1880,
  floorAppliedKcal: null,
  headline: "Your burn looks lower this week",
  whyLine: "Based on what you logged and your latest weight, your maintenance may have shifted.",
  avgThisWeekLabel: "1,920 kcal",
  weightDeltaLabel: "−0.3 kg",
};

const meta = {
  title: "Mobile/Today/WeeklyCheckinModal",
  component: WeeklyCheckinModal,
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
    content,
    currentTargetKcal: 2000,
    onAccept: noop,
    onDismiss: noop,
    cardColor: c.card,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    borderColor: c.border,
  },
} satisfies Meta<typeof WeeklyCheckinModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LowerTarget: Story = {};

export const HigherTarget: Story = {
  args: {
    content: {
      ...content,
      tdeeDeltaKcal: 80,
      suggestedTargetKcal: 2080,
      headline: "Your burn looks higher this week",
    },
  },
};
