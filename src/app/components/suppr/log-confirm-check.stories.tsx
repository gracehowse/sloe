import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LogConfirmCheck } from "./log-confirm-check";

const meta = {
  title: "Suppr/LogConfirmCheck",
  component: LogConfirmCheck,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Calm sage checkmark overlay played over the calorie ring at log commit.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className="relative grid size-40 place-items-center rounded-full border border-border bg-card"
        aria-label="Calorie ring wrapper"
      >
        <span className="text-sm text-muted-foreground">Ring</span>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LogConfirmCheck>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Visible: Story = {
  args: { visible: true },
};

export const Hidden: Story = {
  args: { visible: false },
};
