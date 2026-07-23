import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ProgressBodyCompSection } from "./progress-body-comp-section";

const meta = {
  title: "Suppr/ProgressHierarchy/ProgressBodyCompSection",
  component: ProgressBodyCompSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          "§4 Body composition — user-owned values free; trend chart Pro-gated.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBodyCompSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FreeWithValues: Story = {
  name: "Free tier with values",
  args: {
    userTier: "free",
    latestBodyFatPct: 24.1,
    latestLeanMassKg: 52.3,
  },
};

export const FreeTeaser: Story = {
  name: "Free tier teaser (no data)",
  args: {
    userTier: "free",
    latestBodyFatPct: null,
    latestLeanMassKg: null,
  },
};
