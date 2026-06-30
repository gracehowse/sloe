import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SourceBadge } from "./source-badge";

/**
 * SourceBadge — shows where a recipe was imported from (platform icon + name).
 * Pins each platform so Chromatic guards the icon + colour mapping as a
 * durable regression layer:
 *
 *   - instagram / tiktok / youtube / pinterest / web → platform label.
 *   - user → "Original" (user-created recipe).
 *   - creatorName → overrides the platform label with the creator's handle.
 */
const meta = {
  title: "Suppr/SourceBadge",
  component: SourceBadge,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { source: "instagram" },
  decorators: [
    (Story) => (
      <div style={{ background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SourceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Instagram: Story = { args: { source: "instagram" } };
export const TikTok: Story = { args: { source: "tiktok" } };
export const YouTube: Story = { args: { source: "youtube" } };
export const Pinterest: Story = { args: { source: "pinterest" } };
export const Web: Story = { args: { source: "web" } };
export const Original: Story = {
  name: "Original (user-created)",
  args: { source: "user" },
};

export const WithCreatorName: Story = {
  name: "With creator name",
  args: { source: "instagram", creatorName: "@halfbakedharvest" },
};

/** All platforms side-by-side — pins the icon + colour mapping. */
export const AllSources: Story = {
  name: "All sources",
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxWidth: 320 }}>
      <SourceBadge source="instagram" />
      <SourceBadge source="tiktok" />
      <SourceBadge source="youtube" />
      <SourceBadge source="pinterest" />
      <SourceBadge source="web" />
      <SourceBadge source="user" />
    </div>
  ),
};
