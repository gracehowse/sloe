import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Colors } from "@/constants/theme";
const c = Colors.light;
const noop = () => undefined;

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { PortionStepper } from "./PortionStepper";

const meta = {
  title: "Mobile/Today/PortionStepper",
  component: PortionStepper,
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
  args: { value: 1, onChange: noop, colors: c },
} satisfies Meta<typeof PortionStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const HalfPortion: Story = { args: { value: 0.5 } };
