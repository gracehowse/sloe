import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogSheetBarcodeFreePromise } from "./log-sheet-barcode-free-promise";

const meta = {
  title: "Suppr/LogSheetBarcodeFreePromise",
  component: LogSheetBarcodeFreePromise,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Loud barcode CTA plus free-forever reassurance under LogSheet input methods.",
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
    onOpen: () => undefined,
  },
} satisfies Meta<typeof LogSheetBarcodeFreePromise>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InSheetContext: Story = {
  name: "In sheet context",
  decorators: [
    (Story) => (
      <div className="rounded-t-2xl border border-border bg-card pt-4">
        <Story />
      </div>
    ),
  ],
};
