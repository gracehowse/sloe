import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrendSummaryCard } from "./TrendSummaryCard";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/TrendSummaryCard",
  component: TrendSummaryCard,
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
  args: { title: "Weight trend", summary: "Down 0.4 kg over 30 days", tone: "positive" },
} satisfies Meta<typeof TrendSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Positive = {} as Story;
export const Neutral: Story = { args: { tone: "neutral", summary: "Stable over 30 days" } };
