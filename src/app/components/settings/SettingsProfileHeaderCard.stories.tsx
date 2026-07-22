import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SettingsProfileHeaderCard } from "./SettingsProfileHeaderCard";

const meta = {
  title: "Settings/SettingsProfileHeaderCard",
  component: SettingsProfileHeaderCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    avatarInitial: "G",
    displayLabel: "Grace Howse",
    tierLabel: "Free",
    userTier: "free",
    authEmail: "grace@example.com",
  },
} satisfies Meta<typeof SettingsProfileHeaderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreePlan: Story = {};

export const ProPlan: Story = {
  args: {
    tierLabel: "Pro",
    userTier: "pro",
  },
};
