import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { mobileStoryFrame } from "../_mobileStoryDecorators";
import { NotificationRow } from "./NotificationRow";
import { Accent, Colors } from "@/constants/theme";
import { useAccent } from "@/context/theme";

function Harness(props: Omit<React.ComponentProps<typeof NotificationRow>, "colors" | "accent">) {
  const accent = useAccent();
  return <NotificationRow {...props} colors={Colors.light} accent={Accent} />;
}

const meta = {
  title: "Mobile/Notifications/NotificationRow",
  component: Harness,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UnreadRecipe: Story = {
  args: {
    item: {
      title: "New recipe saved",
      body: "Miso salmon is in your library.",
      createdAt: new Date().toISOString(),
      readAt: null,
      kind: "recipe_saved",
      recipeId: "r1",
    },
    onPress: () => undefined,
  },
};

export const ReadRecap: Story = {
  args: {
    item: {
      title: "Weekly recap ready",
      body: "6 days logged — tap to read your week.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      readAt: new Date().toISOString(),
      kind: "weekly_recap",
    },
    onPress: () => undefined,
  },
};
