import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CancelExportPromptDialog } from "./cancel-export-prompt-dialog";

const meta = {
  title: "Suppr/CancelExportPromptDialog",
  component: CancelExportPromptDialog,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Calm interstitial before subscription cancel — equal-weight export vs continue-to-manage choices.",
      },
    },
  },
  args: {
    open: true,
    onDismiss: () => undefined,
    onExport: () => undefined,
    onContinueToManage: () => undefined,
  },
} satisfies Meta<typeof CancelExportPromptDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Exporting: Story = {
  args: {
    exporting: true,
  },
};
