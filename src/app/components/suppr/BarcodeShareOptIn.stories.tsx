import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BarcodeShareOptIn } from "./BarcodeShareOptIn";

const meta = {
  title: "Suppr/BarcodeShareOptIn",
  component: BarcodeShareOptIn,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Optional community-database opt-in shown after saving a scanned barcode as a private custom food.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    onShare: async (): Promise<{ ok: boolean; error?: string; reasons?: string[] }> => ({ ok: true }),
    onDone: () => undefined,
  },
} satisfies Meta<typeof BarcodeShareOptIn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Prompt: Story = {};

export const WithBarcode: Story = {
  args: {
    barcode: "5056444701234",
    onShare: (): Promise<{ ok: boolean; error?: string; reasons?: string[] }> =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true }), 1200);
      }),
  },
};
