import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { LogConfirmCheck } from "./LogConfirmCheck";

const meta = {
  title: "Mobile/Today/LogConfirmCheck",
  component: LogConfirmCheck,
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
  
} satisfies Meta<typeof LogConfirmCheck>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Play: Story = {
  render: () => (
    <div style={{ position: "relative", width: 200, height: 200 }}>
      <LogConfirmCheck bump={1} />
    </div>
  ),
};
export const Hidden: Story = {
  render: () => (
    <div style={{ position: "relative", width: 200, height: 200 }}>
      <LogConfirmCheck bump={0} />
    </div>
  ),
};
