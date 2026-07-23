import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ActivityLevelPickerDialog } from "./activity-level-picker-dialog";

const meta = {
  title: "Suppr/ActivityLevelPickerDialog",
  component: ActivityLevelPickerDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Settings picker for activity level — live maintenance preview and save to recompute targets.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    currentLevel: "moderate" as const,
    sex: "female" as const,
    weightKg: 68,
    heightCm: 168,
    age: 34,
    onConfirm: () => undefined,
  },
} satisfies Meta<typeof ActivityLevelPickerDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MissingBasics: Story = {
  args: {
    weightKg: null,
    heightCm: null,
    age: null,
  },
};
