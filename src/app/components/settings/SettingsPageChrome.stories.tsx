import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SettingsPageChrome } from "./SettingsPageChrome";
import { noop } from "../_hostStoryFixtures";

const meta = {
  title: "Settings/SettingsPageChrome",
  component: SettingsPageChrome,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ width: 480, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsPageChrome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithMobileBack: Story = {
  args: { onBack: noop },
};
