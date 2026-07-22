import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Sonner toast host wired to the app theme tokens. Mount once near the app root; fire toasts via `toast()` from `sonner`.",
      },
    },
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Host: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast("Meal logged", {
            description: "Greek yogurt bowl · 420 kcal",
          })
        }
      >
        Show toast
      </Button>
    </>
  ),
};

export const SuccessToast: Story = {
  render: () => (
    <>
      <Toaster />
      <Button
        onClick={() =>
          toast.success("Saved", {
            description: "Targets updated for today.",
          })
        }
      >
        Show success toast
      </Button>
    </>
  ),
};
