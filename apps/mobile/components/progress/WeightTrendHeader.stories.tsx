import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightTrendHeader } from "./WeightTrendHeader";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/WeightTrendHeader",
  component: WeightTrendHeader,
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
  args: { trend: "down", isImperial: false, periodLabel: "This month" },
} satisfies Meta<typeof WeightTrendHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Losing = {} as Story;
export const Imperial: Story = { args: { isImperial: true } };
