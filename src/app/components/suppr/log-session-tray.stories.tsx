import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogSessionTray } from "./log-session-tray";
import type { LogSessionTrayItem } from "../../../lib/nutrition/logSessionTray";

const trayItem = (
  over: Partial<LogSessionTrayItem> = {},
): LogSessionTrayItem => ({
  mealId: "m1",
  title: "Chicken breast, grilled",
  kcal: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  slot: "Lunch",
  kcalIsVerified: true,
  ...over,
});

const meta = {
  title: "Suppr/LogSessionTray",
  component: LogSessionTray,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Log-session tray — running receipt of items committed this sheet session.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    pendingUndoIds: [],
    onUndo: () => undefined,
    onDone: () => undefined,
  },
} satisfies Meta<typeof LogSessionTray>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SingleItem: Story = {
  args: {
    items: [trayItem()],
  },
};

export const MultiItemWithSave: Story = {
  args: {
    items: [
      trayItem({ mealId: "m1" }),
      trayItem({
        mealId: "m2",
        title: "Brown rice, cooked",
        kcal: 216,
        protein: 5,
        carbs: 45,
        fat: 1.8,
      }),
    ],
    onSaveMeal: () => undefined,
  },
};
