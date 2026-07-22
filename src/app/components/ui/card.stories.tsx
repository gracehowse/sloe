import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Button } from "./button";

const meta = {
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Anatomy role **Card** (shadcn wrapper) — container for user content. Product chrome should prefer `SupprCard` for ENG-1497 flat + hairline + radius-24. See `docs/design/2026-07-22-ui-anatomy-program.md`.",
      },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Breakfast</CardTitle>
        <CardDescription>Logged · 420 kcal</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Greek yogurt, berries, honey.</p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Weekly plan</CardTitle>
        <CardDescription>7 meals queued</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm">
            Open
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Mon–Sun balanced around your targets.</p>
      </CardContent>
    </Card>
  ),
};
