import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { Button } from "./button";

const meta = {
  component: Button,
  tags: ["ai-generated"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Log meal" },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: /log meal/i });
    await expect(button).not.toHaveAttribute("aria-disabled", "true");
  },
};

export const CssCheck: Story = {
  args: { children: "Submit" },
  play: async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: /submit/i });
    // Sloe: the default Button bg is `--primary-solid` = `--accent-primary-solid`.
    // The 2026-06-08 aubergine accent system set the light-theme value to deep
    // plum #3B2A4D = rgb(59, 42, 77) (was clay #A0552E; the accent moved off the
    // crowded warm-orange recipe lane). Keep in sync with src/styles/theme.css.
    await expect(getComputedStyle(button).backgroundColor).toBe("rgb(59, 42, 77)");
  },
};

export const Secondary: Story = { args: { variant: "secondary", children: "Cancel" } };
export const Outline: Story = { args: { variant: "outline", children: "View recipe" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Delete entry" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Skip" } };
export const Link: Story = { args: { variant: "link", children: "Learn more" } };
export const Small: Story = { args: { size: "sm", children: "Add" } };
export const Large: Story = { args: { size: "lg", children: "Continue" } };
export const Icon: Story = { args: { size: "icon", children: "+" } };

export const AsChild: Story = {
  args: {
    asChild: true,
    children: <a href="/today">Go to Today</a>,
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Saving…" },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /saving/i })).toBeDisabled();
  },
};
