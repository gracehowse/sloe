import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { InputModeRow } from "./log-sheet-input-mode-row";

const meta = {
  title: "Suppr/LogSheetInputModeRow",
  component: InputModeRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "LogSheet logging-method row — v3 method grid or legacy circular chips.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    barcode: { onOpen: () => undefined },
    voice: { onStart: () => undefined },
    photo: { onCapture: () => undefined },
    label: { onCapture: () => undefined },
    describe: { locked: false },
    onQuickAdd: () => undefined,
    onDescribe: () => undefined,
  },
} satisfies Meta<typeof InputModeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnlockedMethods: Story = {};

export const ProLockedAi: Story = {
  args: {
    voice: { onStart: () => undefined, locked: true },
    photo: { onCapture: () => undefined, locked: true },
    describe: { locked: true },
    aiMethodTooltipVisible: true,
  },
};
