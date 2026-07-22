import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Salad, CircleAlert } from "lucide-react-native";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { NutritionDetailEmptyState } from "./NutritionDetailEmptyState";

const meta = {
  title: "Mobile/Nutrition/NutritionDetailEmptyState",
  component: NutritionDetailEmptyState,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof NutritionDetailEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyDay: Story = {
  args: {
    icon: Salad,
    title: "Nothing logged yet",
    subtitle: "Log a meal to see your protein breakdown.",
    ctaLabel: "Go back",
    onPress: () => undefined,
  },
};

export const ErrorState: Story = {
  args: {
    icon: CircleAlert,
    title: "Could not load",
    subtitle: "Check your connection and try again.",
    ctaLabel: "Retry",
    onPress: () => undefined,
  },
};
