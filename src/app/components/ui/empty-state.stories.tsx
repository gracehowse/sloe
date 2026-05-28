import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Inbox } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

const meta = {
  component: EmptyState,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <Inbox className="size-6 text-muted-foreground" aria-hidden />,
    title: "No meals logged yet",
    body: "Tap Log a meal to add your first entry for today.",
    primaryCta: <Button>Log a meal</Button>,
    secondaryCta: (
      <Button variant="ghost" type="button">
        Learn more
      </Button>
    ),
  },
};

export const TitleOnly: Story = {
  args: { title: "Nothing here" },
};

export const WithBodyOnly: Story = {
  args: {
    title: "No results",
    body: "Try a different search term.",
  },
};

export const WithoutIcon: Story = {
  args: {
    title: "No icon",
    body: "Icon slot omitted.",
  },
};

/** Non-string title — aria-label stays undefined (decorative region). */
export const RichTitle: Story = {
  args: {
    title: (
      <>
        No meals yet — <strong>today</strong>
      </>
    ),
    body: "Rich title node without string aria-label.",
  },
};

export const PrimaryCtaOnly: Story = {
  args: {
    title: "Start logging",
    primaryCta: <Button>Log a meal</Button>,
  },
};
