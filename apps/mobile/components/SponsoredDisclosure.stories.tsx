import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { SponsoredDisclosure } from "./SponsoredDisclosure";

const meta = {
  title: "Mobile/Components/SponsoredDisclosure",
  component: SponsoredDisclosure,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SponsoredDisclosure>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InlineSponsored: Story = {
  args: { kind: "sponsored", partnerName: "Acme Foods" },
};

export const BlockAffiliate: Story = {
  args: { kind: "affiliate", variant: "block" },
};
