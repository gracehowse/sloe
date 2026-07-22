import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightChart } from "./WeightChart";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/WeightChart",
  component: WeightChart,
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
  args: { data: [{ date: "1 Jul", value: 73.1, ma: 73.0 }, { date: "15 Jul", value: 72.4, ma: 72.6, isToday: true }], goalWeightKg: 68, isImperial: false, onLogWeight: () => undefined },
} satisfies Meta<typeof WeightChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Sparse: Story = { args: { data: [{ date: "15 Jul", value: 72.4, isToday: true }] } };
