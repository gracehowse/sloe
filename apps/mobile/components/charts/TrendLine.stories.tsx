import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TrendLine from "./TrendLine";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Charts/TrendLine",
  component: TrendLine,
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
  args: { data: [{ label: "1 Jul", value: 73.1 }, { label: "15 Jul", value: 72.4 }], goalValue: 68, color: "#3B2A4D", labelColor: "#6B6574", trackColor: "#E8E6EF", formatValue: (v) => `${v.toFixed(1)} kg` },
} satisfies Meta<typeof TrendLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const WithProjection: Story = { args: { projectedData: [{ label: "22 Jul", value: 72.1 }] } };
