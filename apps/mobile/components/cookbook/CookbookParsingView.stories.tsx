import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStorySafeArea } from "../_mobileStoryDecorators";
import { CookbookParsingView } from "./CookbookParsingView";

const meta = {
  title: "Mobile/Cookbook/CookbookParsingView",
  component: CookbookParsingView,
  tags: ["autodocs"],
  decorators: [mobileStorySafeArea],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof CookbookParsingView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Extracting: Story = {
  args: { parsingMessage: "Extracting recipes…", onBack: () => undefined },
};

export const Matching: Story = {
  args: { parsingMessage: "Matching nutrition…", onBack: () => undefined },
};
