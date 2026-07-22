import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressEnergyTriad } from "./ProgressEnergyTriad";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/ProgressEnergyTriad",
  component: ProgressEnergyTriad,
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
  args: { avgIntakeKcal: 1800, maintenanceKcal: 2200, isAdaptive: true },
} satisfies Meta<typeof ProgressEnergyTriad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deficit = {} as Story;
export const Surplus: Story = { args: { avgIntakeKcal: 2400, maintenanceKcal: 2200, isAdaptive: false } };
