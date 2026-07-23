import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CookLogServingsDialog } from "./cook-log-servings-dialog";

const meta = {
  title: "Suppr/CookLogServingsDialog",
  component: CookLogServingsDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Cook-mode confirmation for how many servings were eaten before logging to Today.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    batchScale: 1,
    baseServings: 4,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof CookLogServingsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ScaledBatch: Story = {
  args: {
    batchScale: 1.5,
    baseServings: 4,
  },
};
