import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStorySafeArea } from "../_mobileStoryDecorators";
import { CookbookSuccessView } from "./CookbookSuccessView";

const meta = {
  title: "Mobile/Cookbook/CookbookSuccessView",
  component: CookbookSuccessView,
  tags: ["autodocs"],
  decorators: [mobileStorySafeArea],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CookbookSuccessView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    savedCount: 12,
    bookName: "Weeknight Suppers",
    onViewLibrary: () => undefined,
    onBuildPlan: () => undefined,
  },
};

export const UntitledBook: Story = {
  args: {
    savedCount: 3,
    bookName: "",
    onViewLibrary: () => undefined,
    onBuildPlan: () => undefined,
  },
};
