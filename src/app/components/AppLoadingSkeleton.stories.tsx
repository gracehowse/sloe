import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppLoadingSkeleton } from "./AppLoadingSkeleton";

const meta = {
  title: "Host/AppLoadingSkeleton",
  component: AppLoadingSkeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-screen branded loading gate for auth/profile waits — mark pulse + sr-only status.",
      },
    },
  },
} satisfies Meta<typeof AppLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CustomScreenReaderLabel: Story = {
  name: "Custom sr-only label",
  args: {
    label: "Loading profile",
  },
};
