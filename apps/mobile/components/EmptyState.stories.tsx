import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { BookOpen } from "lucide-react-native";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "Mobile/Components/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithIllustration: Story = {
  args: {
    illustration: <BookOpen size={30} color="#3B2A4D" strokeWidth={1.75} />,
    title: "Nothing here yet",
    description: "Save a recipe and it shows up in your library.",
  },
};

export const TitleOnly: Story = {
  args: { title: "No results", description: "Try a different search." },
};
