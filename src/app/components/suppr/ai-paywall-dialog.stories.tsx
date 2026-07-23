import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AiPaywallDialog } from "./ai-paywall-dialog";

const meta = {
  title: "Suppr/AiPaywallDialog",
  component: AiPaywallDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Factual Pro paywall for gated AI logging entry points (voice / photo).",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: () => undefined,
  },
} satisfies Meta<typeof AiPaywallDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const VoiceLog: Story = {
  args: { feature: "voice_log" },
};

export const PhotoLog: Story = {
  args: { feature: "photo_log" },
};
