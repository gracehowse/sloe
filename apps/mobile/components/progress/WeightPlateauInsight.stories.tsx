import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WeightPlateauInsight } from "./WeightPlateauInsight";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/WeightPlateauInsight",
  component: WeightPlateauInsight,
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
  args: { weeksFlat: 3, onLearnMore: () => undefined },
} satisfies Meta<typeof WeightPlateauInsight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default = {} as Story;
export const Dismissed: Story = { args: { dismissed: true } };
