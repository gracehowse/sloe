import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { Button } from "./button";

const meta = {
  component: HoverCard,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Hover / focus preview card (Radix Hover Card). Use for lightweight enrichment without committing to a dialog.",
      },
    },
  },
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@suppr</Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="text-sm font-medium">Suppr</p>
        <p className="text-sm text-muted-foreground">Recipe + nutrition tracking.</p>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const Open: Story = {
  render: () => (
    <HoverCard open>
      <HoverCardTrigger asChild>
        <Button variant="link">@suppr</Button>
      </HoverCardTrigger>
      <HoverCardContent>
        <p className="text-sm font-medium">Suppr</p>
        <p className="text-sm text-muted-foreground">Recipe + nutrition tracking.</p>
      </HoverCardContent>
    </HoverCard>
  ),
};
