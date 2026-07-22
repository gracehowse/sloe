import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TrustPageHeader } from "./TrustPageHeader";

const meta = {
  title: "Suppr/Trust/TrustPageHeader",
  component: TrustPageHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    title: "Privacy Policy",
    lastUpdated: "April 2026",
    version: "v1.0",
    subtitle: "How Sloe handles your data.",
    revisionPath: "app/privacy/page.tsx",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrustPageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutCrossLinks: Story = {
  args: { showCrossLinks: false },
};
