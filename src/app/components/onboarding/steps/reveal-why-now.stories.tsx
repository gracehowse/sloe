import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RevealWhyNowReflection } from "./reveal-why-now";

const meta = {
  title: "Suppr/Onboarding/Steps/RevealWhyNowReflection",
  component: RevealWhyNowReflection,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    whyNow: "feel-better",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, padding: 16, background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RevealWhyNowReflection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FeelBetterIntent: Story = {};

export const StrongerIntent: Story = {
  args: { whyNow: "stronger" },
};
