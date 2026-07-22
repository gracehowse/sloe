import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { ImportCaptionPreviewCard } from "./ImportCaptionPreviewCard";

function ImportCaptionPreviewCardDemo(
  props: Omit<
    ComponentProps<typeof ImportCaptionPreviewCard>,
    "captionDraft" | "captionEditing" | "onCaptionChange" | "onToggleEdit"
  > & {
    initialCaption?: string;
    initialEditing?: boolean;
  },
) {
  const { initialCaption = "", initialEditing = false, ...rest } = props;
  const [captionDraft, setCaptionDraft] = useState(initialCaption);
  const [captionEditing, setCaptionEditing] = useState(initialEditing);
  return (
    <ImportCaptionPreviewCard
      {...rest}
      captionDraft={captionDraft}
      captionEditing={captionEditing}
      onCaptionChange={setCaptionDraft}
      onToggleEdit={() => setCaptionEditing((v) => !v)}
    />
  );
}

const sampleCaption = `Soothing chicken congee
Serves 4 · 35 min
2 cups jasmine rice
1.2 L chicken stock
400 g poached chicken
Ginger, spring onion, soy to finish`;

const meta = {
  title: "Suppr/Import/ImportCaptionPreviewCard",
  component: ImportCaptionPreviewCardDemo,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    platform: "instagram",
    busy: false,
    onConfirm: () => {},
    onPhotoInstead: () => {},
    onLinkInstead: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImportCaptionPreviewCardDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyDraft: Story = {
  args: { initialCaption: "" },
};

export const ReadyToImport: Story = {
  args: { initialCaption: sampleCaption },
};

export const Editing: Story = {
  args: {
    initialCaption: sampleCaption,
    initialEditing: true,
  },
};
