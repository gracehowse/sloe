import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AnalyticsConsentToggle } from "./AnalyticsConsentToggle";

const meta = {
  title: "Settings/AnalyticsConsentToggle",
  component: AnalyticsConsentToggle,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 420, padding: 20 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnalyticsConsentToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DarkMode: Story = {
  parameters: { themes: { themeOverride: "dark" } },
};
