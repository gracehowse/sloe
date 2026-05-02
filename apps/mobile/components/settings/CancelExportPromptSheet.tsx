import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Download, Settings, X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * CancelExportPromptSheet — Suppr-owned interstitial that surfaces the
 * data-export prompt at the cancel touchpoint instead of leaving it
 * buried 4-5 taps deep in Settings.
 *
 * Closes journey-architect P1: "The export prompt is buried deep in
 * Settings. A user who taps 'Manage subscription' and cancels never
 * sees the export prompt unless they actively look for it. The export
 * is reactive (user must find it), not proactive (not shown at cancel
 * time)."
 *
 * Two equal-weight cards:
 *   - "Take your data with you" → host fires `onExport`. The host
 *     runs the existing CSV export and re-presents this sheet (or
 *     dismisses, depending on the host's preference) so the user can
 *     continue to manage if they still want to.
 *   - "Continue to manage" → host fires `onContinueToManage` which
 *     routes to RevenueCat's customerCenter (or the Apple/Play
 *     fallback URL).
 *
 * The X icon dismisses without taking either action.
 *
 * Web parity: `src/app/components/suppr/cancel-export-prompt-dialog.tsx`.
 */
export interface CancelExportPromptSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Fires when the user taps the "Take your data with you" card. */
  onExport: () => void;
  /** Fires when the user taps "Continue to manage". */
  onContinueToManage: () => void;
}

export function CancelExportPromptSheet({
  visible,
  onDismiss,
  onExport,
  onContinueToManage,
}: CancelExportPromptSheetProps) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss subscription management options"
        style={{
          flex: 1,
          backgroundColor: "#00000066",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => {}}
          testID="cancel-export-prompt-sheet"
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.xl,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: Spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Before you go
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginTop: 4,
                }}
              >
                Want a copy of your nutrition log first? You can do both — export
                now and still manage your subscription after.
              </Text>
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={{ marginTop: Spacing.lg, gap: Spacing.sm }}>
            <Pressable
              testID="cancel-export-prompt-export"
              onPress={onExport}
              accessibilityRole="button"
              accessibilityLabel="Take your data with you — export nutrition log first"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.md,
                padding: Spacing.lg,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Accent.primary,
                backgroundColor: Accent.primary + "10",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: Accent.primary + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Download size={18} color={Accent.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  Take your data with you
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Export your nutrition log as a CSV before any change.
                </Text>
              </View>
            </Pressable>

            <Pressable
              testID="cancel-export-prompt-continue"
              onPress={onContinueToManage}
              accessibilityRole="button"
              accessibilityLabel="Continue to manage subscription"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.md,
                padding: Spacing.lg,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                backgroundColor: colors.background,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.cardBorder,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Settings size={18} color={colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: colors.text,
                  }}
                >
                  Continue to manage
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  Open the App Store / Play Store subscription page.
                </Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default CancelExportPromptSheet;
