import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import MiniBarChart from "./MiniBarChart";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Charts/MiniBarChart",
  component: MiniBarChart,
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
  args: { data: [{ label: "M", value: 1400 }, { label: "T", value: 1520 }], goalLine: 1500, color: "#3B2A4D", trackColor: "#E8E6EF", labelColor: "#6B6574" },
} satisfies Meta<typeof MiniBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const NoGoal: Story = { args: { goalLine: undefined } };
