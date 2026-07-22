import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookOpen, Utensils } from "lucide-react";
import { SupprButton } from "./suppr-button";
import { EmptyState } from "./empty-state";

const meta = {
  title: "Suppr/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Shared empty-state primitive (icon/illustration + title + description + optional CTA).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, background: "var(--bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "No meals logged yet",
    description: "Tap Log to add your first entry for today.",
  },
};

export const WithIllustrationAndCta: Story = {
  name: "Illustration + CTA",
  args: {
    illustration: <Utensils aria-hidden />,
    title: "Your cookbook is empty",
    description: "Save a few recipes and we'll suggest from there.",
    cta: <SupprButton variant="primary" label="Browse recipes" onClick={() => undefined} />,
  },
};

export const WithIcon: Story = {
  args: {
    icon: <BookOpen aria-hidden />,
    title: "Nothing in this week",
    description: "Plan a meal to fill the calendar.",
  },
};
