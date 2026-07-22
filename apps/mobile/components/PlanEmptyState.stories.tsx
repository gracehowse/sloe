import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mobileStoryFrame } from "./_mobileStoryDecorators";
import { PlanEmptyState } from "./PlanEmptyState";

const meta = {
  title: "Mobile/Components/PlanEmptyState",
  component: PlanEmptyState,
  tags: ["autodocs"],
  decorators: [mobileStoryFrame],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PlanEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBrowseLibrary: () => undefined,
    planImportEnabled: false,
    onImport: () => undefined,
  },
};

export const WithImport: Story = {
  args: {
    onBrowseLibrary: () => undefined,
    planImportEnabled: true,
    onImport: () => undefined,
  },
};
