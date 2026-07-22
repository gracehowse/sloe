import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CopySlotDialog } from "./copy-slot-dialog";

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

const meta = {
  title: "Suppr/CopySlotDialog",
  component: CopySlotDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Whole-slot copy host — wraps CopyMealDialog and commits every entry in a journal slot.",
      },
    },
  },
  args: {
    target: { slot: "Lunch" },
    onClose: () => undefined,
    sourceDayKey: "2026-07-21",
    slots: SLOTS,
    mealsGrouped: [
      { name: "Breakfast", meals: [{}] },
      { name: "Lunch", meals: [{}, {}] },
      { name: "Dinner", meals: [] },
      { name: "Snacks", meals: [{}] },
    ],
    copySlotToDateRange: async () => ({
      itemCount: 2,
      createdIdsByDay: { "2026-07-22": ["meal-a", "meal-b"] },
    }),
    undoCopyToSlot: () => undefined,
  },
} satisfies Meta<typeof CopySlotDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = {
  args: {
    target: null,
  },
};
