/**
 * LogSheetInputModeRow — the row of logging-method chips (Scan / Voice /
 * Photo / Quick add) at the head of the LogSheet browse tab. Extracted from
 * `LogSheet.tsx` (ENG-1252) to keep that flagship sheet trending toward the
 * 400-line target as new surface lands here.
 *
 * AI methods (Voice / Photo) are Pro-gated and render a PRO badge when
 * `locked`. ENG-1252 adds an optional one-line discoverability tooltip
 * ("AI logging — available with Pro.") under the FIRST rendered + locked AI
 * chip; the host owns whether it shows via `aiMethodTooltipVisible` (gate:
 * `@suppr/shared/today/aiMethodTooltip`). The row stays tier-agnostic — it
 * only adds the bubble to a chip it already shows as locked, and never twice.
 */

import { Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, Mic, PencilLine, ScanBarcode, type Search } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { AI_METHOD_TOOLTIP_TEXT } from "@suppr/shared/today/aiMethodTooltip";
import { ProMethodBadge } from "@/components/today/ProMethodBadge";
import type { LogSheetProps } from "./LogSheet";

export function LogSheetInputModeRow({
  barcode,
  voice,
  photo,
  aiMethodTooltipVisible = false,
  onQuickAdd,
}: {
  barcode: LogSheetProps["barcode"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  /** ENG-1252 — host-gated discoverability tooltip flag. */
  aiMethodTooltipVisible?: boolean;
  onQuickAdd?: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const modes: {
    key: "scan" | "voice" | "photo" | "quick";
    label: string;
    Icon: typeof Search;
    onPress?: () => void;
    locked?: boolean;
    /** True for the AI methods (voice / photo) whose lock the tooltip explains. */
    aiMethod?: boolean;
  }[] = [
    {
      key: "scan",
      label: "Scan",
      Icon: ScanBarcode,
      onPress: barcode?.onOpen,
    },
    {
      key: "voice",
      label: "Voice",
      Icon: Mic,
      onPress: voice?.onStart,
      locked: voice?.locked ?? false,
      aiMethod: true,
    },
    {
      key: "photo",
      label: "Photo",
      Icon: Camera,
      onPress: photo?.onCapture,
      locked: photo?.locked ?? false,
      aiMethod: true,
    },
    {
      key: "quick",
      label: "Quick add",
      Icon: PencilLine,
      onPress: onQuickAdd,
    },
  ];
  // ENG-1252 — anchor the tooltip under the FIRST rendered + locked AI method
  // so it never renders twice; host owns whether it shows at all.
  const tooltipKey = aiMethodTooltipVisible
    ? modes.find((m) => m.aiMethod && m.locked && m.onPress)?.key ?? null
    : null;
  return (
    <View style={styles.inputModeRow} testID="log-sheet-input-mode-row">
      {modes.map(({ key, label, Icon, onPress, locked }) =>
        onPress ? (
          <View key={key} style={styles.inputModeCell}>
            <Pressable
              onPress={() => {
                if (process.env.EXPO_OS === "ios") {
                  void Haptics.selectionAsync();
                }
                onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={locked ? `${label} (Pro)` : label}
              style={({ pressed }) => [
                styles.inputModeButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Icon size={22} color={accent.primary} strokeWidth={2} />
              {locked ? <ProMethodBadge style={styles.proBadgeAnchor} /> : null}
            </Pressable>
            <Text style={[styles.inputModeLabel, { color: colors.textSecondary }]}>{label}</Text>
            {key === tooltipKey ? (
              <Text
                testID="log-sheet-ai-method-tooltip"
                style={[styles.aiMethodTooltip, { color: accent.primarySolid }]}
              >
                {AI_METHOD_TOOLTIP_TEXT}
              </Text>
            ) : null}
          </View>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputModeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  inputModeCell: {
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  inputModeButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  inputModeLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  // ENG-1252 — first-session AI-method caption under the locked chip label;
  // accent-coloured Pro nudge, matching the sibling `inputModeLabel` type
  // (11/medium). The cell's `gap` handles spacing so the row never shifts.
  aiMethodTooltip: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  proBadgeAnchor: {
    position: "absolute",
    top: -2,
    right: -2,
  },
});
