import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Snowflake, Sparkles } from "lucide-react";
import { Badge, type BadgeVariant } from "./badge";

const VARIANTS: BadgeVariant[] = [
  "neutral",
  "info",
  "warn",
  "pro",
  "ai",
  "added",
  "override",
  "leftover",
  "custom",
  "freeze",
];

const meta = {
  title: "Suppr/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compact semantic pill for row/title tags (AI, Pro, Override, Freeze, etc.).",
      },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { variant: "neutral", children: "Tag" },
};

export const AllVariants: Story = {
  name: "All variants",
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {VARIANTS.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    variant: "ai",
    icon: <Sparkles aria-hidden />,
    children: "AI",
  },
};

export const Freeze: Story = {
  args: {
    variant: "freeze",
    icon: <Snowflake aria-hidden />,
    children: "Freeze",
  },
};
