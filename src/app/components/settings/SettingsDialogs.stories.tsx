import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SettingsDialogs } from "./SettingsDialogs";
import { noop } from "../_hostStoryFixtures";

const baseArgs = {
  cancelPromptOpen: false,
  cancelPromptExporting: false,
  onCancelPromptDismiss: noop,
  onCancelPromptExport: noop,
  onCancelPromptContinueToManage: noop,
  activityPickerOpen: false,
  onActivityPickerOpenChange: noop,
  activityLevel: "moderate" as const,
  profileSex: "female" as const,
  profileWeightKg: 68,
  profileHeightCm: 168,
  profileAge: 32,
  profileGoal: "lose",
  profilePlanPace: "steady" as const,
  profileNutritionStrategy: "balanced" as const,
  onActivityLevelConfirm: noop,
  appleHealthInfoOpen: false,
  onAppleHealthInfoOpenChange: noop,
  eraseEverythingOpen: false,
  onEraseEverythingOpenChange: noop,
  onEraseEverythingConfirm: noop,
  clearLocalOpen: false,
  onClearLocalOpenChange: noop,
  onClearLocalConfirm: noop,
  accountDeletionStage: "idle" as const,
  onAccountDeletionStageChange: noop,
  onAccountDeleteConfirm: noop,
};

const meta = {
  title: "Settings/SettingsDialogs",
  component: SettingsDialogs,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: baseArgs,
} satisfies Meta<typeof SettingsDialogs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CancelExportPrompt: Story = {
  args: { ...baseArgs, cancelPromptOpen: true },
};

export const ActivityLevelPicker: Story = {
  args: { ...baseArgs, activityPickerOpen: true },
};

export const AppleHealthInfo: Story = {
  args: { ...baseArgs, appleHealthInfoOpen: true },
};

export const EraseEverything: Story = {
  args: { ...baseArgs, eraseEverythingOpen: true },
};

export const ClearLocalData: Story = {
  args: { ...baseArgs, clearLocalOpen: true },
};

export const AccountDeletionFirst: Story = {
  args: { ...baseArgs, accountDeletionStage: "first" },
};

export const AccountDeletionSecond: Story = {
  args: { ...baseArgs, accountDeletionStage: "second" },
};
