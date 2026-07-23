import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SettingsSloeProBanner } from "./settings-sloe-pro-banner";

const meta = {
  title: "Settings/SettingsSloeProBanner",
  component: SettingsSloeProBanner,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  args: { isPro: false },
} satisfies Meta<typeof SettingsSloeProBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreeUpgrade: Story = {};

export const ProActive: Story = {
  args: { isPro: true },
};
