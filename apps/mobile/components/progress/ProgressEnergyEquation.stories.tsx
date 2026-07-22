import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressEnergyEquation } from "./ProgressEnergyEquation";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";

const meta = {
  title: "Mobile/Progress/ProgressEnergyEquation",
  component: ProgressEnergyEquation,
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
  args: { intakeKcal: 1800, maintenanceKcal: 2200 },
} satisfies Meta<typeof ProgressEnergyEquation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Deficit = {} as Story;
export const Surplus: Story = { args: { intakeKcal: 2400 } };
