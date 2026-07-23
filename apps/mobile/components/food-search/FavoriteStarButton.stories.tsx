import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { FavoriteStarButton } from "./FavoriteStarButton";

const meta = {
  title: "Mobile/FoodSearch/FavoriteStarButton",
  component: FavoriteStarButton,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof FavoriteStarButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unstarred: Story = {
  args: { starred: false, onToggle: () => undefined },
};

export const StarredPending: Story = {
  args: { starred: true, pending: true, onToggle: () => undefined },
};
