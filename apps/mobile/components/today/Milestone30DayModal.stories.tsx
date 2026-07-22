import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
import type { Milestone30DayContent } from "@/lib/milestone30Day";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { Milestone30DayModal } from "./Milestone30DayModal";

const c = Colors.light;
const noop = () => undefined;

const content: Milestone30DayContent = {
  headline: "30 days of showing up",
  daysLogged: 30,
  avgDailyKcal: 1850,
  topFoods: [{ name: "Greek yogurt", count: 12 }],
  longestStreak: 14,
  totalWeightDeltaKg: -1.2,
};

const meta = {
  title: "Mobile/Today/Milestone30DayModal",
  component: Milestone30DayModal,
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
    onDismiss: noop,
    cardColor: c.card,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    borderColor: c.border,
  },
} satisfies Meta<typeof Milestone30DayModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = { args: { visible: false } };
