import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PhotoLogDialog } from "./photo-log-dialog";

const meta = {
  title: "Suppr/PhotoLogDialog",
  component: PhotoLogDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "AI photo logging dialog — forced open on the pick stage (no live analyse).",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
    onCommit: () => undefined,
    activeSlot: "Lunch",
  },
} satisfies Meta<typeof PhotoLogDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PickPro: Story = {
  name: "Pick (Pro)",
  args: { userTier: "pro" },
};

export const PickFree: Story = {
  name: "Pick (free taster)",
  args: {
    userTier: "free",
    onUpgradeRequired: () => undefined,
  },
};
