import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { ScreenSectionChrome } from "./screen-section-chrome";

const meta = {
  title: "Mobile/Suppr/ScreenSectionChrome",
  component: ScreenSectionChrome,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ScreenSectionChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithOverline: Story = {
  args: {
    overline: "Your trends",
    title: "Progress",
    subtitle: "Last 7 days",
    showBrand: false,
  },
};

export const BrandShown: Story = {
  args: {
    overline: null,
    title: "Today",
    showBrand: true,
  },
};
