import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { CompleteDayV3Section } from "./CompleteDayV3Section";

const meta = {
  title: "Mobile/Today/CompleteDayV3Section",
  component: CompleteDayV3Section,
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
    eatenKcal: 1600,
    targetKcal: 2000,
    maintenanceTdeeKcal: 2200,
    projectedKgChange: -0.2,
    textColor: c.text,
    textSecondaryColor: c.textSecondary,
  },
} satisfies Meta<typeof CompleteDayV3Section>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnderTarget: Story = {};
export const OverTarget: Story = { args: { eatenKcal: 2400 } };
