import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell } from "lucide-react";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { IconButton } from "./IconButton";
import { chromaticVisualContract } from "../../../../.storybook/chromaticVisualContract";

const meta = {
  title: "Mobile/UI/IconButton",
  component: IconButton,
  tags: ["autodocs", "chromatic"],
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
    ...chromaticVisualContract.parameters,
    docs: {
      description: {
        component:
          "Anatomy role **IconButton** (mobile) — circular icon control. sm/md/lg diameters on the Spacing ladder.",
      },
    },
  },
  args: {
    icon: Bell,
    onPress: () => undefined,
    accessibilityLabel: "Notifications",
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MutedMd: Story = {
  args: {
    size: "md",
    variant: "muted",
  },
};

export const GhostSm: Story = {
  args: {
    size: "sm",
    variant: "ghost",
  },
};
