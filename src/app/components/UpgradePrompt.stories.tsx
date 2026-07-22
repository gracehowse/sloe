import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SaveLimitBanner, UpgradePrompt } from "./UpgradePrompt";

const meta = {
  title: "Host/UpgradePrompt",
  component: UpgradePrompt,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Inline Pro upgrade pitch when a gated feature is tapped — optional dismiss + compare-plans link.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    feature: "Voice logging",
    requiredTier: "pro",
    currentTier: "free",
    onUpgrade: () => undefined,
    onDismiss: () => undefined,
  },
} satisfies Meta<typeof UpgradePrompt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutDismiss: Story = {
  name: "Without dismiss",
  args: {
    onDismiss: undefined,
  },
};

export const SaveLimitNearCap: Story = {
  name: "Save limit banner (near cap)",
  render: () => (
    <SaveLimitBanner savedCount={8} limit={10} onUpgrade={() => undefined} />
  ),
};

export const SaveLimitAtCap: Story = {
  name: "Save limit banner (at cap)",
  render: () => (
    <SaveLimitBanner savedCount={10} limit={10} onUpgrade={() => undefined} />
  ),
};
