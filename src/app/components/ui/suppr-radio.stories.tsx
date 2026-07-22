import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SupprRadio } from "./suppr-radio";

const meta = {
  component: SupprRadio,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Circular radio indicator — presentational only; parent row owns `role=\"radio\"` (ENG-1662).",
      },
    },
  },
} satisfies Meta<typeof SupprRadio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  args: { checked: false },
};

export const Checked: Story = {
  args: { checked: true },
};
