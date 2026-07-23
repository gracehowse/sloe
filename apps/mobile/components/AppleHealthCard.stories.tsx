import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { AppleHealthCard } from "./AppleHealthCard";

const meta = {
  title: "Mobile/Components/AppleHealthCard",
  component: AppleHealthCard,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppleHealthCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {
    status: "ready",
    steps: 8420,
    activeEnergyKcal: 420,
    restingBurnKcal: 1480,
    weightKg: 72.4,
    useImperial: false,
  },
};

export const Loading: Story = {
  args: {
    status: "loading",
    steps: null,
    activeEnergyKcal: null,
    restingBurnKcal: null,
    weightKg: null,
  },
};

export const Denied: Story = {
  args: {
    status: "denied",
    steps: null,
    activeEnergyKcal: null,
    restingBurnKcal: null,
    weightKg: null,
    onRetry: () => undefined,
  },
};
