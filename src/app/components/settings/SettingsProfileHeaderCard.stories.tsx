import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SettingsProfileHeaderCard } from "./SettingsProfileHeaderCard";

const meta = {
  title: "Settings/SettingsProfileHeaderCard",
  component: SettingsProfileHeaderCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The ONE place web Settings states who you are and which plan you're on. Under `design_consistency_v1` the identity block collapses to the shared `AvatarDisc` + name + a single 'email · Free plan' subline — the same shape as the mobile Settings profile row, with the subline string coming from the shared `formatSettingsProfileSubline` helper so the platforms cannot drift. Plan ACTIONS all live in SubscriptionCard; this card states status once and stops. Flag off restores the hand-rolled 56px gradient avatar, the separate tier pill, and the separate email line.",
      },
    },
  },
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

/** Free account — plan status stated once, on the subline. */
export const FreePlan: Story = {};

export const ProPlan: Story = {
  args: {
    tierLabel: "Pro",
    userTier: "pro",
  },
};

/**
 * Narrow width (≤400px), the ENG-1458 reflow case: the block stacks and the
 * name wraps rather than clipping, because it is the user's own name.
 */
export const NarrowWidth: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 360, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
};

/** A long name against a long email — the truncation case on the single row. */
export const LongNameAndEmail: Story = {
  args: {
    avatarInitial: "M",
    displayLabel: "Marguerite Devereux-Ashworth",
    authEmail: "marguerite.devereux-ashworth@verylongdomainexample.co.uk",
  },
};
