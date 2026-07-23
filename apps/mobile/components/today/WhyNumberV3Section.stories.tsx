import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
import { buildWhyThisNumber } from "@/lib/nutrition/whyThisNumber";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { WhyNumberV3Section } from "./WhyNumberV3Section";

const c = Colors.light;
const noop = () => undefined;

const result = buildWhyThisNumber({
  targetCalories: 1840,
  maintenanceTdee: 2110,
  confidence: "high",
  loggingDays: 21,
  goal: "lose",
  paceKgPerWeek: -0.5,
});

const meta = {
  title: "Mobile/Today/WhyNumberV3Section",
  component: WhyNumberV3Section,
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
    targetCalories: 1840,
    result,
    confidence: "high",
    loggingDays: 21,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
    textTertiaryColor: c.textTertiary,
    borderColor: c.border,
    cardColor: c.card,
    onAdjustTarget: noop,
  },
} satisfies Meta<typeof WhyNumberV3Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighConfidence: Story = {};

export const LowConfidence: Story = { args: { confidence: "low", loggingDays: 2 } };
