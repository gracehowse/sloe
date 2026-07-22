import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreateCustomFoodDialog } from "./create-custom-food-dialog";

const meta = {
  title: "Suppr/CreateCustomFoodDialog",
  component: CreateCustomFoodDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Create or edit a custom food — name, serving row, macro grid, optional detailed nutrition.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onSave: () => undefined,
  },
} satisfies Meta<typeof CreateCustomFoodDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const PrefilledFromSearch: Story = {
  args: {
    initialName: "Greek yoghurt 0%",
  },
};

export const BarcodePrefill: Story = {
  args: {
    initialBarcode: "5056444701234",
    initialName: "Crunchy oat clusters",
  },
};
