import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { BarcodeContributionsSection } from "./BarcodeContributionsSection";

const meta = {
  title: "Settings/BarcodeContributionsSection",
  component: BarcodeContributionsSection,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BarcodeContributionsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLButtonElement>(
      '[data-testid="settings-barcode-contributions-row"] button',
    );
    row?.click();
  },
};
