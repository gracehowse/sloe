/**
 * LogSheetInputModeRow — the row of logging-method affordances at the head of
 * the LogSheet browse tab. Extracted from `LogSheet.tsx` (ENG-1252) to keep
 * that flagship sheet trending toward the 400-line target as new surface lands
 * here. Mirror of the web `InputModeRow`.
 *
 * Two renders, gated on `sloe_v3_log` (ENG-1303, default-ON):
 *   - FLAG ON  → the v3 method-grid TILE grammar: equal-width rounded tiles on
 *     the secondary surface (Photo / Voice / Describe / Quick add), a
 *     frost lock badge in place of the "PRO" text pill on locked AI methods.
 *   - FLAG OFF → the legacy circular input chips (Voice / Photo / Quick add)
 *     with the "PRO" text pill — the kill-switch path, byte-for-byte
 *     the pre-ENG-1303 render.
 *
 * ENG-1532 (`component_grammar_dedup`, default-ON) — one barcode entry point:
 * the flag drops the Scan tile/chip from BOTH renders so the loud
 * "Scan barcode" CTA (`log-sheet-loud-barcode-cta`) is the single scanner
 * entry. OFF = today's render with the Scan tile leading each set,
 * byte-intact. Keep in sync with the web `log-sheet-input-mode-row.tsx`.
 *
 * AI methods (Voice / Photo) are Pro-gated and render a lock badge (or the
 * legacy PRO pill) when `locked`. ENG-1252 adds an optional one-line
 * discoverability tooltip ("AI logging — available with Pro.") under the FIRST
 * rendered + locked AI method; the host owns whether it shows via
 * `aiMethodTooltipVisible` (gate: `@suppr/shared/today/aiMethodTooltip`). The
 * row stays tier-agnostic — it only adds the bubble to a method it already
 * shows as locked, and never twice. Describe is a first-class method that
 * expands the inline describe flow via the host-owned `onDescribe` callback
 * (the host paywalls it when locked, exactly as for the collapsed entry).
 */

import { StyleSheet, Text, View } from "react-native";
import {
  Camera,
  Lock,
  Mic,
  PencilLine,
  ScanBarcode,
  type Search,
} from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { AI_METHOD_TOOLTIP_TEXT } from "@suppr/shared/today/aiMethodTooltip";
import { ProMethodBadge } from "@/components/today/ProMethodBadge";
import type { LogSheetProps } from "./LogSheet";

type Mode = {
  key: "scan" | "photo" | "voice" | "describe" | "quick";
  label: string;
  Icon: typeof Search;
  onPress?: () => void;
  locked?: boolean;
  /** True for the AI methods (voice / photo) whose lock the tooltip explains. */
  aiMethod?: boolean;
};

export function LogSheetInputModeRow({
  barcode,
  voice,
  photo,
  describe,
  aiMethodTooltipVisible = false,
  onQuickAdd,
  onDescribe,
  hidden = false,
}: {
  barcode: LogSheetProps["barcode"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  /** ENG-1303 — Describe as a first-class method tile. Present only when the
   *  host wires the inline describe flow; `locked` mirrors `describe.locked`. */
  describe?: { locked?: boolean };
  /** ENG-1252 — host-gated discoverability tooltip flag. */
  aiMethodTooltipVisible?: boolean;
  onQuickAdd?: () => void;
  /** ENG-1303 — host expands (or paywalls) the inline describe flow. */
  onDescribe?: () => void;
  hidden?: boolean;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const v3 = isFeatureEnabled("sloe_v3_log");
  // ENG-1532 — one barcode entry point (`component_grammar_dedup`): ON drops
  // the Scan tile/chip (the loud CTA is the single scanner entry); OFF renders
  // today's sets with Scan leading, byte-intact. Keep in sync with web.
  const dedup = isFeatureEnabled("component_grammar_dedup");

  const scan: Mode = { key: "scan", label: "Scan", Icon: ScanBarcode, onPress: barcode?.onOpen };
  const voiceMode: Mode = {
    key: "voice",
    label: "Voice",
    Icon: Mic,
    onPress: voice?.onStart,
    locked: voice?.locked ?? false,
    aiMethod: true,
  };
  const photoMode: Mode = {
    key: "photo",
    label: "Photo",
    Icon: Camera,
    onPress: photo?.onCapture,
    locked: photo?.locked ?? false,
    aiMethod: true,
  };
  const describeMode: Mode = {
    key: "describe",
    label: "Describe",
    Icon: PencilLine,
    onPress: describe ? onDescribe : undefined,
    locked: describe?.locked ?? false,
  };
  const quick: Mode = { key: "quick", label: "Quick add", Icon: PencilLine, onPress: onQuickAdd };

  // The v3 grid follows the prototype LogHub method-grid order (Scan / Photo /
  // Voice / Describe / Quick add); the legacy chips keep their historical
  // Scan / Voice / Photo / Quick add order so the flag-off path is byte-for-byte
  // the pre-ENG-1303 render.
  const modes: Mode[] = v3
    ? dedup
      ? [photoMode, voiceMode, describeMode, quick]
      : [scan, photoMode, voiceMode, describeMode, quick]
    : dedup
      ? [voiceMode, photoMode, quick]
      : [scan, voiceMode, photoMode, quick];

  // ENG-1252 — anchor the tooltip under the FIRST rendered + locked AI method
  // so it never renders twice; host owns whether it shows at all.
  const tooltipKey = aiMethodTooltipVisible
    ? modes.find((m) => m.aiMethod && m.locked && m.onPress)?.key ?? null
    : null;

  if (hidden) return null;

  if (v3) {
    return (
      <View style={styles.grid} testID="log-sheet-input-mode-row">
        {modes.map(({ key, label, Icon, onPress, locked }) =>
          onPress ? (
            <View key={key} style={styles.gridCell}>
              <PressableScale
                haptic="selection"
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={locked ? `${label} (Pro)` : label}
                testID={`log-sheet-method-${key}`}
                style={[
                  styles.tile,
                  { backgroundColor: colors.backgroundSecondary },
                ]}
              >
                <Icon size={22} color={accent.primary} strokeWidth={2} />
                {/* ENG-1529 — F-36 Dynamic Type clamp (library.tsx convention):
                    tight tile chrome caps at 1.2× so single-word labels never
                    clip mid-glyph; VoiceOver reads the uncapped a11y label. */}
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={[styles.tileLabel, { color: colors.text }]}
                >
                  {label}
                </Text>
                {locked ? (
                  <View
                    testID={`log-sheet-method-lock-${key}`}
                    style={[styles.lockBadge, { backgroundColor: colors.fillQuiet }]}
                  >
                    <Lock size={11} color={accent.primary} strokeWidth={2} />
                  </View>
                ) : null}
              </PressableScale>
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

  // Kill switch (flag OFF) — the legacy circular chips, byte-for-byte.
  return (
    <View style={styles.inputModeRow} testID="log-sheet-input-mode-row">
      {modes.map(({ key, label, Icon, onPress, locked }) =>
        onPress ? (
          <View key={key} style={styles.inputModeCell}>
            <PressableScale
              haptic="selection"
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={locked ? `${label} (Pro)` : label}
              style={[
                styles.inputModeButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Icon size={22} color={accent.primary} strokeWidth={2} />
              {locked ? <ProMethodBadge style={styles.proBadgeAnchor} /> : null}
            </PressableScale>
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
  // ── v3 method-grid tile grammar (ENG-1303, prototype LogHub `.method-grid`)
  grid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  gridCell: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  tile: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.dense,
    paddingHorizontal: Spacing.xs,
    position: "relative",
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  lockBadge: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 18,
    height: 18,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Legacy circular chips (flag OFF — kill switch, byte-for-byte).
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
  // ENG-1252 — first-session AI-method caption under the locked chip/tile;
  // accent-coloured Pro nudge, matching the sibling label type (11/medium).
  // The cell's `gap` handles spacing so the row never shifts.
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
