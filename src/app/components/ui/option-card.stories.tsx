import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Activity } from "lucide-react";
import { IconBox } from "./icon-box";
import { OptionCard } from "./option-card";

const meta = {
  component: OptionCard,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof OptionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  args: {
    title: "Lightly active",
    subtitle: "Exercise 1–3 days per week",
    icon: (
      <IconBox tone="primary" size="md">
        <Activity aria-hidden />
      </IconBox>
    ),
  },
};

export const Selected: Story = {
  args: {
    selected: true,
    title: "Very active",
    subtitle: "Exercise 6–7 days per week",
    icon: (
      <IconBox tone="primary" size="md">
        <Activity aria-hidden />
      </IconBox>
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /very active/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};

export const Compact: Story = {
  args: {
    compact: true,
    title: "Maintain weight",
    selected: false,
  },
};

export const SelectedCompact: Story = {
  args: {
    compact: true,
    selected: true,
    title: "Lose weight",
  },
};

export const NoSubtitle: Story = {
  args: {
    title: "Sedentary",
    selected: false,
  },
};

export const CustomTrailing: Story = {
  args: {
    title: "Custom trailing",
    trailing: <span className="text-xs text-muted-foreground">Soon</span>,
  },
};

export const SuppressTrailing: Story = {
  args: {
    title: "No trailing control",
    trailing: null,
  },
};

export const CompactWithIcon: Story = {
  args: {
    compact: true,
    selected: true,
    title: "Moderately active",
    subtitle: "3–5 days per week",
    icon: (
      <IconBox tone="primary" size="md">
        <Activity aria-hidden />
      </IconBox>
    ),
  },
};

export const WithThumbnail: Story = {
  args: {
    selected: true,
    title: "Mediterranean",
    subtitle: "Fresh, balanced, olive-oil forward",
    thumbnail: (
      <img
        src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=112&h=112&fit=crop"
        alt=""
        className="size-full object-cover"
      />
    ),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /mediterranean/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};
