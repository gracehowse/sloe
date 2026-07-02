"use client";

/**
 * SettingsDialogs — the modal/dialog cluster for the web Settings screen.
 *
 * Extracted verbatim from `Settings.tsx` (2026-06-23, ENG-1225 gap #24) so
 * the host stays under its line-count pin while the v3 two-pane layout
 * branch is added. PURE presentation + the existing handlers, passed down
 * unchanged — no behaviour change, no copy change. The dialogs render
 * outside the page layout (portal-mounted overlays), so they sit at the
 * Settings root regardless of single-pane vs two-pane shell.
 *
 * Covers:
 *  - Cancel-flow export prompt (CancelExportPromptDialog)
 *  - Activity-level picker (ActivityLevelPickerDialog)
 *  - Apple Health explainer (informational only — iOS-only HealthKit)
 *  - Erase-everything confirm (RESET typed)
 *  - Delete-local-data confirm
 *  - Two-stage account-deletion confirm
 *
 * Mobile parity: the matching sheets live in
 * `apps/mobile/components/settings/` (CancelExportPromptSheet, the reset
 * modal in SettingsBundleContent). This file is web-only chrome.
 */

import type { ReactNode } from "react";
import { CancelExportPromptDialog } from "../suppr/cancel-export-prompt-dialog";
import { ActivityLevelPickerDialog } from "../suppr/activity-level-picker-dialog";
import { DestructiveConfirmDialog } from "../suppr/destructive-confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import type {
  ActivityLevel,
  NutritionStrategy,
  PlanPace,
  Sex,
} from "../../../lib/nutrition/tdee.ts";

export interface SettingsDialogsProps {
  // Cancel-flow export prompt.
  cancelPromptOpen: boolean;
  cancelPromptExporting: boolean;
  onCancelPromptDismiss: () => void;
  onCancelPromptExport: () => void;
  onCancelPromptContinueToManage: () => void;
  // Activity-level picker.
  activityPickerOpen: boolean;
  onActivityPickerOpenChange: (open: boolean) => void;
  activityLevel: ActivityLevel | null;
  profileSex: Sex;
  profileWeightKg: number | null;
  profileHeightCm: number | null;
  profileAge: number | null;
  profileGoal: string | null;
  profilePlanPace: PlanPace | null;
  profileNutritionStrategy: NutritionStrategy | null;
  onActivityLevelConfirm: (nextLevel: ActivityLevel) => void | Promise<void>;
  // Apple Health explainer.
  appleHealthInfoOpen: boolean;
  onAppleHealthInfoOpenChange: (open: boolean) => void;
  // Erase everything.
  eraseEverythingOpen: boolean;
  onEraseEverythingOpenChange: (open: boolean) => void;
  onEraseEverythingConfirm: () => void | Promise<void>;
  // Delete local data.
  clearLocalOpen: boolean;
  onClearLocalOpenChange: (open: boolean) => void;
  onClearLocalConfirm: () => void | Promise<void>;
  // Account deletion (two-stage).
  accountDeletionStage: "idle" | "first" | "second";
  onAccountDeletionStageChange: (stage: "idle" | "first" | "second") => void;
  onAccountDeleteConfirm: () => void | Promise<void>;
}

/** The kept/cleared ledger rendered inside the erase-everything confirm. */
const ERASE_LEDGER: { label: string; kept: boolean }[] = [
  { label: "Food log", kept: false },
  { label: "Daily journal", kept: false },
  { label: "Library saves", kept: false },
  { label: "Shopping lists", kept: false },
  { label: "Imported recipes", kept: false },
  { label: "Synced activity", kept: false },
  { label: "Your account", kept: true },
  { label: "Subscription", kept: true },
];

const eraseDescription: ReactNode = (
  <span className="block">
    <span className="block text-xs text-muted-foreground mb-3">
      You can re-import from your export file anytime.
    </span>
    <span className="block space-y-1.5 mt-1">
      {ERASE_LEDGER.map((row) => (
        <span key={row.label} className="flex items-center gap-2.5 text-[13px]">
          <span
            className={`inline-block w-3.5 text-center font-bold ${
              row.kept ? "text-success" : "text-destructive"
            }`}
            aria-label={row.kept ? "Kept" : "Cleared"}
          >
            {row.kept ? "✓" : "✗"}
          </span>
          <span
            className={
              row.kept ? "text-foreground" : "text-muted-foreground line-through"
            }
          >
            {row.label}
          </span>
        </span>
      ))}
    </span>
  </span>
);

export function SettingsDialogs(props: SettingsDialogsProps) {
  const {
    cancelPromptOpen,
    cancelPromptExporting,
    onCancelPromptDismiss,
    onCancelPromptExport,
    onCancelPromptContinueToManage,
    activityPickerOpen,
    onActivityPickerOpenChange,
    activityLevel,
    profileSex,
    profileWeightKg,
    profileHeightCm,
    profileAge,
    profileGoal,
    profilePlanPace,
    profileNutritionStrategy,
    onActivityLevelConfirm,
    appleHealthInfoOpen,
    onAppleHealthInfoOpenChange,
    eraseEverythingOpen,
    onEraseEverythingOpenChange,
    onEraseEverythingConfirm,
    clearLocalOpen,
    onClearLocalOpenChange,
    onClearLocalConfirm,
    accountDeletionStage,
    onAccountDeletionStageChange,
    onAccountDeleteConfirm,
  } = props;

  return (
    <>
      {/* Cancel-flow export prompt (PR replaces #43, 2026-05-02). Surfaces
          the data-export prompt AT the cancel touchpoint so users with
          active subscriptions aren't routed to /account/billing without
          ever seeing the option to take their data with them first.
          Mobile parity: CancelExportPromptSheet.tsx. */}
      <CancelExportPromptDialog
        open={cancelPromptOpen}
        exporting={cancelPromptExporting}
        onDismiss={onCancelPromptDismiss}
        onExport={onCancelPromptExport}
        onContinueToManage={onCancelPromptContinueToManage}
      />

      {/* Activity level picker (build 10 fix E-2, 2026-04-19). */}
      <ActivityLevelPickerDialog
        open={activityPickerOpen}
        onOpenChange={onActivityPickerOpenChange}
        currentLevel={activityLevel ?? "sedentary"}
        sex={profileSex}
        weightKg={profileWeightKg}
        heightCm={profileHeightCm}
        age={profileAge}
        goal={profileGoal}
        planPace={profilePlanPace}
        nutritionStrategy={profileNutritionStrategy}
        onConfirm={onActivityLevelConfirm}
      />

      {/* Apple Health explainer (ENG-1200). Honest, informational only —
          web cannot connect HealthKit (iOS-only). No connect toggle, no
          fabricated state. */}
      <Dialog open={appleHealthInfoOpen} onOpenChange={onAppleHealthInfoOpenChange}>
        <DialogContent data-testid="settings-apple-health-info-dialog">
          <DialogHeader>
            <DialogTitle>Apple Health syncs from iOS</DialogTitle>
            <DialogDescription>
              Apple Health connects in the Sloe iOS app — HealthKit is
              iOS-only, so there&rsquo;s nothing to connect here on the web.
              Once it&rsquo;s connected on your iPhone, your steps, active
              energy, and weight show up across Today and Progress here,
              read-only.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Erase everything (RESET typed). Scannable ✓/✗ ledger so the user
          can verify what goes / stays at a glance. Mirror of the mobile
          reset modal in SettingsBundleContent.tsx. */}
      <DestructiveConfirmDialog
        typeToConfirm="RESET"
        open={eraseEverythingOpen}
        onOpenChange={onEraseEverythingOpenChange}
        title="Delete your data and start fresh?"
        description={eraseDescription}
        confirmLabel="Erase everything"
        onConfirm={onEraseEverythingConfirm}
      />

      <DestructiveConfirmDialog
        open={clearLocalOpen}
        onOpenChange={onClearLocalOpenChange}
        title="Delete local data & sign out?"
        description="This will sign you out and remove Sloe data stored on this device."
        confirmLabel="Delete & sign out"
        onConfirm={onClearLocalConfirm}
      />

      {/* Two-stage account deletion so a careless tap cannot wipe the
          account: first dialog warns about permanence, second reiterates. */}
      <DestructiveConfirmDialog
        open={accountDeletionStage === "first"}
        onOpenChange={(o) => {
          if (!o) onAccountDeletionStageChange("idle");
        }}
        title="Delete your account?"
        description="This will permanently delete your account and all associated data. This action cannot be undone."
        confirmLabel="Continue"
        onConfirm={async () => {
          onAccountDeletionStageChange("second");
        }}
      />
      <DestructiveConfirmDialog
        open={accountDeletionStage === "second"}
        onOpenChange={(o) => {
          if (!o) onAccountDeletionStageChange("idle");
        }}
        title="Are you sure?"
        description="Your recipes, logs, meal plans, and profile will be permanently deleted."
        confirmLabel="Delete account"
        onConfirm={onAccountDeleteConfirm}
      />
    </>
  );
}

export default SettingsDialogs;
