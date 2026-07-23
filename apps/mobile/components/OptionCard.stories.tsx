import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Target } from "lucide-react-native";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { OptionCard } from "./OptionCard";

const meta = {
  title: "Mobile/Components/OptionCard",
  component: OptionCard,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
  args: {
    title: "Lose weight steadily",
    subtitle: "A calm deficit you can sustain",
    icon: <Target size={18} color="#3B2A4D" />,
    onPress: () => undefined,
  },
};

export const Selected: Story = {
  args: {
    selected: true,
    title: "Maintain",
    subtitle: "Hold where you are",
    onPress: () => undefined,
  },
};
