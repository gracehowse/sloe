import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SupprButton } from "@/components/ui/SupprButton";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  RESET_PLAN_SHEET_COPY,
  type ResetPlanMode,
} from "@suppr/shared/planning/resetPlanSheet";

export interface ResetPlanSheetProps {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  onConfirm: (mode: ResetPlanMode) => void;
}

function RadioRow({
  checked,
  title,
  subtitle,
  onPress,
  colors,
  accent,
}: {
  checked: boolean;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      style={[styles.row, { borderBottomColor: colors.border }, checked && { backgroundColor: `${accent}14` }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
      <View
        style={[
          styles.radioOuter,
          { borderColor: checked ? accent : colors.textTertiary },
        ]}
      >
        {checked ? <View style={[styles.radioInner, { backgroundColor: accent }]} /> : null}
      </View>
    </Pressable>
  );
}

/** ENG-1261 / B28 — keep vs clear before plan regenerate (mobile). */
export function ResetPlanSheet({
  visible,
  onClose,
  loading = false,
  onConfirm,
}: ResetPlanSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const accent = colors.tint;
  const [mode, setMode] = useState<ResetPlanMode>("keep");

  useEffect(() => {
    if (visible) setMode("keep");
  }, [visible]);

  const copy = RESET_PLAN_SHEET_COPY;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close reset plan">
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
          testID="reset-plan-sheet"
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>{copy.title}</Text>
          <Text style={[styles.insight, { color: colors.textSecondary }]}>{copy.insight}</Text>

          <View style={[styles.card, { borderColor: colors.border }]}>
            <RadioRow
              checked={mode === "keep"}
              title={copy.keep.title}
              subtitle={copy.keep.subtitle}
              onPress={() => setMode("keep")}
              colors={colors}
              accent={accent}
            />
            <RadioRow
              checked={mode === "clear"}
              title={copy.clear.title}
              subtitle={copy.clear.subtitle}
              onPress={() => setMode("clear")}
              colors={colors}
              accent={accent}
            />
          </View>

          {mode === "clear" ? (
            <View
              style={[styles.warn, { backgroundColor: colors.backgroundSecondary }]}
              testID="reset-plan-clear-warning"
            >
              <AlertTriangle size={15} color={Accent.destructive} />
              <Text style={[styles.warnText, { color: Accent.destructive }]}>{copy.clearWarning}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <SupprButton variant="ghost" style={styles.footerBtn} disabled={loading} onPress={onClose}>
              {copy.cancel}
            </SupprButton>
            <SupprButton
              variant="primary"
              style={styles.footerBtn}
              loading={loading}
              onPress={() => onConfirm(mode)}
              testID="reset-plan-confirm"
            >
              <View style={styles.confirmInner}>
                <RefreshCw size={17} color={colors.primaryForeground} />
                <Text style={[styles.confirmLabel, { color: colors.primaryForeground }]}>
                  {copy.confirm}
                </Text>
              </View>
            </SupprButton>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  title: { ...Type.title, fontWeight: "700" as const },
  insight: { ...Type.body, marginTop: Spacing.sm, lineHeight: 20 },
  card: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, paddingRight: Spacing.md },
  rowTitle: { ...Type.body, fontWeight: "600" },
  rowSub: { ...Type.caption, marginTop: 2 },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.8,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 8, height: 8, borderRadius: 4 },
  warn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
  },
  warnText: { ...Type.caption, flex: 1, lineHeight: 18 },
  footer: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  footerBtn: { flex: 1 },
  confirmInner: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  confirmLabel: { ...Type.body, fontWeight: "600" },
});
