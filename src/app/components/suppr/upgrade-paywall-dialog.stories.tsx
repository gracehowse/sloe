import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UpgradePaywallDialog } from "./upgrade-paywall-dialog";

const meta = {
  title: "Suppr/UpgradePaywallDialog",
  component: UpgradePaywallDialog,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    onOpenChange: () => undefined,
    from: "settings",
    userTier: "free",
    bypassSessionCap: true,
  },
} satisfies Meta<typeof UpgradePaywallDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MonthlyDefault: Story = {};

export const AnnualTrial: Story = {
  args: { defaultPeriod: "annual" },
};
