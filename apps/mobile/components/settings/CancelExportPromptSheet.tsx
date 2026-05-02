import React, { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Download, ArrowRight } from "lucide-react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";

/**
 * CancelExportPromptSheet — Suppr-owned bottom sheet shown BEFORE the
 * platform's billing / customer-center surface during cancellation.
 *
 * Decision posture (docs/decisions/2026-05-02-cancel-export-prompt.md):
 *   - This is calm-tone trust, NOT retention-via-friction.
 *   - Both options carry equal weight visually; copy is descriptive,
 *     not desperate. No "Wait, are you sure?", no offers, no upsells.
 *   - The user's explicit goal is to cancel; this sheet adds value
 *     (their data is theirs) without standing in their way.
 *
 * Wired into `apps/mobile/app/(tabs)/settings.tsx` Manage-subscription
 * row. The sheet is purely UI — both onExport / onContinueCancelling
 * are owned by the host so the data fetch + Share.share / billing-
 * portal hop stay in one place.
 */
export interface CancelExportPromptSheetProps {
  visible: boolean;
  /** "Take your data with you" — host fetches `nutrition_entries`,
   *  serialises via `nutritionLogToCsv`, and presents the share sheet.
   *  Returns the row count so the sheet can render a confirmation
   *  state ("Exported 342 entries") rather than appearing inert. */
  onExport: () => Promise<{ rowCount: number } | null>;
  /** "Continue cancelling" — host routes through to RevenueCat
   *  customer-center (mobile) / Stripe billing portal (web). */
  onContinueCancelling: () => void;
  /** Backdrop tap / close X. Equivalent to "Continue cancelling"
   *  semantically — but emits `cancel_export_dismissed` rather than
   *  `cancel_proceeded` so the funnel can distinguish accidental
   *  closes from deliberate routing. Today both branches do the
   *  same thing visually; analytics event distinguishes intent. */
  onClose: () => void;
  cardColor: string;
  textColor: string;
  textSecondaryColor: string;
  borderColor: string;
}

export function CancelExportPromptSheet({
  visible,
  onExport,
  onContinueCancelling,
  onClose,
  cardColor,
  textColor,
  textSecondaryColor,
  borderColor,
}: CancelExportPromptSheetProps) {
  const insets = useSafeAreaInsets();
  const [exporting, setExporting] = useState(false);
  const [exportedRowCount, setExportedRowCount] = useState<number | null>(null);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await onExport();
      if (result) {
        setExportedRowCount(result.rowCount);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: cardColor,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ position: "absolute", top: 16, right: 20 }}
          >
            <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
          </Pressable>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: textColor,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            Before you go
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: textSecondaryColor,
              textAlign: "center",
              marginBottom: Spacing.xl,
              paddingHorizontal: 4,
            }}
          >
            Your data is yours. You can take it with you, or carry on to
            the cancellation page — whichever you prefer.
          </Text>

          {/* Export card */}
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="Take your data with you"
            testID="cancel-export-take-data-row"
            style={{
              borderWidth: 1,
              borderColor,
              borderRadius: Radius.md,
              padding: Spacing.md,
              marginBottom: Spacing.md,
              opacity: exporting ? 0.7 : 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: Accent.primary + "18",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Download size={18} color={Accent.primary} strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: textColor }}
                >
                  Take your data with you
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: textSecondaryColor,
                    marginTop: 2,
                  }}
                >
                  {exportedRowCount != null
                    ? `Exported ${exportedRowCount.toLocaleString("en-GB")} entries.`
                    : exporting
                      ? "Preparing your CSV…"
                      : "Download your full nutrition log as a CSV."}
                </Text>
              </View>
              <ArrowRight size={18} color={textSecondaryColor} strokeWidth={2} />
            </View>
          </Pressable>

          {/* Continue cancelling card */}
          <Pressable
            onPress={onContinueCancelling}
            accessibilityRole="button"
            accessibilityLabel="Continue cancelling"
            testID="cancel-export-continue-row"
            style={{
              borderWidth: 1,
              borderColor,
              borderRadius: Radius.md,
              padding: Spacing.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: borderColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ArrowRight size={18} color={textColor} strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: textColor }}
                >
                  Continue cancelling
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: textSecondaryColor,
                    marginTop: 2,
                  }}
                >
                  Open your subscription page to cancel.
                </Text>
              </View>
              <ArrowRight size={18} color={textSecondaryColor} strokeWidth={2} />
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default CancelExportPromptSheet;
