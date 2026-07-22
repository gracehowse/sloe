import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { LogSheetInputModeRow } from "./LogSheetInputModeRow";

const meta = {
  title: "Mobile/Today/LogSheetInputModeRow",
  component: LogSheetInputModeRow,
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
    barcode: { onOpen: noop },
    voice: { onStart: noop, locked: true },
    photo: { onCapture: noop, locked: true },
    label: { onCapture: noop },
    describe: { locked: false },
    onQuickAdd: noop,
    onDescribe: noop,
  },
} satisfies Meta<typeof LogSheetInputModeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProLockedAi: Story = {};
export const AllUnlocked: Story = {
  args: { voice: { onStart: noop, locked: false }, photo: { onCapture: noop, locked: false } },
};
