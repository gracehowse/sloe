import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BarcodeSavedAckDialog } from "./BarcodeSavedAckDialog";

const meta = {
  title: "Suppr/BarcodeSavedAckDialog",
  component: BarcodeSavedAckDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Post-save confirmation after contributing a not-found barcode as a custom food (Complete Day v3).",
      },
    },
  },
  args: {
    open: true,
    productName: "Crunchy oat clusters",
    onLogNow: () => undefined,
  },
} satisfies Meta<typeof BarcodeSavedAckDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongProductName: Story = {
  args: {
    productName: "Organic dark chocolate & sea salt protein bar (60 g)",
  },
};
