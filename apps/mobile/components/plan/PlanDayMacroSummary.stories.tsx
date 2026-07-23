import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MacroColors } from "@/constants/theme";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PlanDayMacroSummary } from "./PlanDayMacroSummary";

const meta = {
  title: "Mobile/Plan/PlanDayMacroSummary",
  component: PlanDayMacroSummary,
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
    cells: [
      { label: "P", value: 90, target: 130, color: MacroColors.protein },
      { label: "C", value: 140, target: 195, color: MacroColors.carbs },
      { label: "F", value: 50, target: 62, color: MacroColors.fat },
      { label: "Fi", value: 18, target: 41, color: MacroColors.fiber },
    ],
  },
} satisfies Meta<typeof PlanDayMacroSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack: Story = {};

export const OverUnderMix: Story = {
  args: {
    cells: [
      { label: "P", value: 40, target: 130, color: MacroColors.protein },
      { label: "C", value: 220, target: 195, color: MacroColors.carbs },
      { label: "F", value: 80, target: 62, color: MacroColors.fat },
      { label: "Fi", value: 8, target: 41, color: MacroColors.fiber },
    ],
  },
};
