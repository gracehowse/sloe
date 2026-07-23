import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { FirstLogAcknowledgment } from "./FirstLogAcknowledgment";

const meta = {
  title: "Mobile/Today/FirstLogAcknowledgment",
  component: FirstLogAcknowledgment,
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
  args: { visible: true },
} satisfies Meta<typeof FirstLogAcknowledgment>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {};
export const Hidden: Story = { args: { visible: false } };
