import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import {
  ActivityLevelPreview,
  type ActivityLevelPreviewProps,
} from "./activity-level-preview";

function ActivityLevelPreviewStory(props: ActivityLevelPreviewProps) {
  const [selected, setSelected] = useState(props.selected);
  return <ActivityLevelPreview {...props} selected={selected} onSelect={setSelected} />;
}

const meta = {
  title: "Suppr/ActivityLevelPreview",
  component: ActivityLevelPreviewStory,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Five activity-level options with live maintenance-kcal preview — shared by onboarding and settings.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    sex: "female" as const,
    weightKg: 68,
    heightCm: 168,
    age: 34,
    selected: "moderate" as const,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof ActivityLevelPreviewStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithOptions: Story = {};

export const PreviewLineOnly: Story = {
  args: {
    renderOptions: false,
  },
};

export const MissingBasics: Story = {
  args: {
    weightKg: null,
    heightCm: null,
    age: null,
  },
};
