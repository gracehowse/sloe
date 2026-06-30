import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SponsoredDisclosure } from "./sponsored-disclosure";

/**
 * SponsoredDisclosure — universal partner / affiliate / ad disclosure marker
 * (FTC §255.5 / ASA CAP §3 / EU UCPD). Pins each kind + both layout variants
 * so Chromatic guards the legally-load-bearing labels as a durable regression
 * layer:
 *
 *   - kind: sponsored / affiliate / ad → "Sponsored" / "Affiliate link" / "Ad".
 *   - variant: inline (small pill) / block (full-width banner above a row).
 *   - partnerName → appends "· Brand" inline.
 */
const meta = {
  title: "Suppr/SponsoredDisclosure",
  component: SponsoredDisclosure,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: { kind: "sponsored", variant: "inline" },
  decorators: [
    (Story) => (
      <div style={{ width: 320, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SponsoredDisclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InlineSponsored: Story = {
  name: "Inline · Sponsored",
  args: { kind: "sponsored", variant: "inline" },
};

export const InlineAffiliate: Story = {
  name: "Inline · Affiliate",
  args: { kind: "affiliate", variant: "inline" },
};

export const InlineAd: Story = {
  name: "Inline · Ad",
  args: { kind: "ad", variant: "inline" },
};

export const InlineWithPartner: Story = {
  name: "Inline · with partner",
  args: { kind: "sponsored", variant: "inline", partnerName: "HelloFresh" },
};

export const BlockSponsored: Story = {
  name: "Block banner · Sponsored",
  args: { kind: "sponsored", variant: "block", partnerName: "HelloFresh" },
};

export const BlockAffiliate: Story = {
  name: "Block banner · Affiliate",
  args: { kind: "affiliate", variant: "block" },
};
