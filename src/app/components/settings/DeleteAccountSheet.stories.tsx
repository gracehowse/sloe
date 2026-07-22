import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { formatDeleteAccountLedgerRows } from "@/lib/settings/deleteAccountFlow";
import { DeleteAccountSheet } from "./DeleteAccountSheet";
import { noop } from "../_hostStoryFixtures";

const ledger = formatDeleteAccountLedgerRows({
  diaryEntries: 842,
  recipes: 36,
  weightDays: 120,
  inHousehold: true,
});

const meta = {
  title: "Settings/DeleteAccountSheet",
  component: DeleteAccountSheet,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Three-step account deletion sheet with optional export-first.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: noop,
    ledger,
    onExportFirst: noop,
    onDeleteForever: noop,
  },
} satisfies Meta<typeof DeleteAccountSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StepOneReason: Story = {};

export const StepTwoLedger: Story = {
  play: async ({ canvasElement }) => {
    const continueBtn = Array.from(canvasElement.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Continue",
    );
    continueBtn?.click();
  },
};

export const LoadingLedger: Story = {
  args: { loadingLedger: true },
};
