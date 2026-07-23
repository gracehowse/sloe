import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { FatSecretBadge } from "./FatSecretBadge";

const meta = {
  title: "Mobile/UI/FatSecretBadge",
  component: FatSecretBadge,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MobileStoryThemeProvider>
        <div style={{ width: 360, padding: 16, background: "#F7F6FA" }}>
          <Story />
        </div>
      </MobileStoryThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Mandatory FatSecret Platform API attribution. Text variant is offline-safe; badge variant loads the official remote image.",
      },
    },
  },
} satisfies Meta<typeof FatSecretBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BadgeImage: Story = {
  args: { variant: "badge" },
};

export const TextAttribution: Story = {
  args: { variant: "text" },
};

export const Hidden: Story = {
  args: { show: false },
};
