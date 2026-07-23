import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoggedConfirmation } from "./log-sheet-confirmation";

const meta = {
  title: "Suppr/LogSheetConfirmation",
  component: LoggedConfirmation,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "S13 logged confirmation — calm success state after a log commits.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className="flex w-[360px] flex-col rounded-t-2xl border border-border bg-card"
        style={{ minHeight: 480 }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LoggedConfirmation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithUndo: Story = {
  args: {
    confirmation: {
      title: "Greek yogurt, plain",
      kcal: 130,
      kcalIsVerified: true,
      slot: "Breakfast",
      source: "off",
      onDone: () => undefined,
      onUndo: () => undefined,
    },
  },
};

export const DoneOnly: Story = {
  args: {
    confirmation: {
      title: "Avocado toast",
      kcal: 285,
      kcalIsVerified: false,
      slot: "Lunch",
      source: "manual",
      onDone: () => undefined,
    },
  },
};
