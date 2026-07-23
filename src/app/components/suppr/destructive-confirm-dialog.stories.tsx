import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DestructiveConfirmDialog } from "./destructive-confirm-dialog";

const meta = {
  title: "Suppr/DestructiveConfirmDialog",
  component: DestructiveConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Themed destructive confirmation (AlertDialog) — optional type-to-confirm gate.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof DestructiveConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeleteMeal: Story = {
  args: {
    title: 'Delete "Oats with berries"?',
    description: "This can't be undone.",
    confirmLabel: "Delete",
  },
};

export const TypeToConfirm: Story = {
  name: "Type to confirm",
  args: {
    title: "Erase everything?",
    description: "Type RESET to confirm. This permanently deletes your journal.",
    confirmLabel: "Erase everything",
    typeToConfirm: "RESET",
  },
};
