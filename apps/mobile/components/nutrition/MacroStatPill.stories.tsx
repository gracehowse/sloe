import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { MacroStatPill } from "./MacroStatPill";
import { MacroColors } from "@/constants/theme";

const meta = {
  title: "Mobile/Nutrition/MacroStatPill",
  component: MacroStatPill,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MacroStatPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnTrack: Story = {
  args: {
    label: "Protein",
    current: 98,
    target: 140,
    color: MacroColors.protein,
    variant: "delta",
  },
};

export const WithProgressFill: Story = {
  args: {
    label: "Carbs",
    current: 160,
    target: 220,
    color: MacroColors.carbs,
    showProgressFill: true,
  },
};
