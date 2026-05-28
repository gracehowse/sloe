import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SupprCard } from "./suppr-card";

const meta = {
  component: SupprCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof SupprCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: {
    tone: "neutral",
    children: <p className="text-sm text-foreground">Plan your week in one place.</p>,
  },
};

export const PrimarySoft: Story = {
  args: {
    tone: "primary",
    children: <p className="text-sm text-foreground">Bonus day — targets scaled for recovery.</p>,
  },
};

export const PrimaryNoBorder: Story = {
  args: {
    tone: "primary",
    border: false,
    children: <p className="text-sm text-foreground">Primary, no border</p>,
  },
};

export const SuccessNoBorder: Story = {
  args: {
    tone: "success",
    border: false,
    children: <p className="text-sm text-foreground">Success, no border</p>,
  },
};

export const PrimaryGradientNoBorder: Story = {
  args: {
    tone: "primary",
    gradient: true,
    border: false,
    children: <p className="text-sm text-foreground">Gradient without border</p>,
  },
};

export const PrimaryGradient: Story = {
  args: {
    tone: "primary",
    gradient: true,
    padding: "lg",
    children: <p className="text-sm font-medium text-foreground">North-star highlight card</p>,
  },
};

export const Success: Story = {
  args: {
    tone: "success",
    children: <p className="text-sm text-foreground">You hit your protein target.</p>,
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    children: <p className="text-sm text-foreground">Over your calorie target.</p>,
  },
};

export const Magenta: Story = {
  args: {
    tone: "magenta",
    children: <p className="text-sm text-foreground">AI-generated recipe</p>,
  },
};

export const SheetElevation: Story = {
  args: {
    elevation: "sheet",
    tone: "neutral",
    children: <p className="text-sm text-foreground">Sheet elevation</p>,
  },
};

export const FloatElevation: Story = {
  args: {
    elevation: "float",
    tone: "neutral",
    children: <p className="text-sm text-foreground">Float elevation</p>,
  },
};

export const NoBorder: Story = {
  args: {
    border: false,
    tone: "neutral",
    children: <p className="text-sm text-foreground">Borderless card</p>,
  },
};

export const WarningNoBorder: Story = {
  args: {
    tone: "warning",
    border: false,
    children: <p className="text-sm text-foreground">Warning without border</p>,
  },
};

export const MagentaNoBorder: Story = {
  args: {
    tone: "magenta",
    border: false,
    children: <p className="text-sm text-foreground">Magenta without border</p>,
  },
};

export const Flat: Story = {
  args: {
    elevation: "none",
    tone: "neutral",
    children: <p className="text-sm text-foreground">No shadow</p>,
  },
};
