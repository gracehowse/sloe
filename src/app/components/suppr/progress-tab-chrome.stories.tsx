import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressTabChrome } from "./progress-tab-chrome";

const meta = {
  title: "Suppr/ProgressTabChrome",
  component: ProgressTabChrome,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Sticky Progress mobile-web header — Your trends overline over Progress title.",
      },
    },
  },
} satisfies Meta<typeof ProgressTabChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    overline: "Your trends",
  },
};

export const WithSubtitle: Story = {
  args: {
    overline: "Your trends",
    subtitle: "Last 30 days",
  },
};
