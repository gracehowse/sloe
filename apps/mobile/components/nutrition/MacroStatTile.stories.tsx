import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Dumbbell } from "lucide-react-native";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { MacroStatTile } from "./MacroStatTile";
import { MacroColors, Colors } from "@/constants/theme";

const meta = {
  title: "Mobile/Nutrition/MacroStatTile",
  component: MacroStatTile,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MacroStatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

const text = Colors.light;

export const Default: Story = {
  args: {
    macroKey: "protein",
    label: "Protein",
    Icon: Dumbbell,
    current: 92,
    target: 140,
    unit: "g",
    color: MacroColors.protein,
    textColor: text.text,
    textSecondaryColor: text.textSecondary,
    textTertiaryColor: text.textTertiary,
    barTrackColor: text.border,
  },
};

export const OverTarget: Story = {
  args: {
    macroKey: "carbs",
    label: "Carbs",
    Icon: Dumbbell,
    current: 240,
    target: 220,
    unit: "g",
    color: MacroColors.carbs,
    textColor: text.text,
    textSecondaryColor: text.textSecondary,
    textTertiaryColor: text.textTertiary,
    barTrackColor: text.border,
  },
};
