import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell } from "lucide-react";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { IconButton } from "./IconButton";

const meta = {
  title: "Mobile/UI/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ padding: 16 }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Anatomy role **IconButton** (mobile) — circular icon control. sm=32, md=40 on the Spacing ladder.",
      },
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QuietMd: Story = {
  args: {
    accessibilityLabel: "Notifications",
    size: "md",
    tone: "quiet",
    children: <Bell size={18} />,
  },
};

export const GhostSm: Story = {
  args: {
    accessibilityLabel: "Notifications",
    size: "sm",
    tone: "ghost",
    children: <Bell size={16} />,
  },
};
