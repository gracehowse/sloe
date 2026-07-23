import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import ActivityLevelPreview from "./ActivityLevelPreview";

const meta = {
  title: "Mobile/Components/ActivityLevelPreview",
  component: ActivityLevelPreview,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ActivityLevelPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithOptions: Story = {
  args: {
    sex: "female",
    weightKg: 68,
    heightCm: 168,
    age: 32,
    selected: "moderate",
    onSelect: () => undefined,
  },
};

export const PreviewOnly: Story = {
  args: {
    sex: "male",
    weightKg: 82,
    heightCm: 180,
    age: 28,
    selected: "light",
    renderOptions: false,
    onSelect: () => undefined,
  },
};
