import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SupprButton } from "@/components/ui/SupprButton";
import { SheetShell } from "@/components/ui/SheetShell";
import { SupprRadio } from "@/components/ui/SupprRadio";
import { SupprNotice } from "@/components/ui/SupprNotice";
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
      <SupprRadio checked={checked} accentColor={accent} />
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
  const colors = useThemeColors();
  const accent = colors.tint;
  const [mode, setMode] = useState<ResetPlanMode>("keep");

  useEffect(() => {
    if (visible) setMode("keep");
  }, [visible]);

  const copy = RESET_PLAN_SHEET_COPY;

  return (
    <SheetShell
      visible={visible}
      onClose={onClose}
      animationType="fade"
      testID="reset-plan-sheet"
    >
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
        <SupprNotice
          tone="destructive"
          variant="inline"
          testID="reset-plan-clear-warning"
          accessibilityRole="alert"
          leading={<AlertTriangle size={15} color={Accent.destructive} />}
          style={{ marginTop: Spacing.md }}
        >
          <Text style={[styles.warnText, { color: Accent.destructive }]}>{copy.clearWarning}</Text>
        </SupprNotice>
      ) : null}

      <View style={styles.footer}>
        <SupprButton
          variant="ghost"
          style={styles.footerBtn}
          disabled={loading}
          onPress={onClose}
          label={copy.cancel}
        />
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
    </SheetShell>
  );
}

const styles = StyleSheet.create({
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
  warnText: { ...Type.caption, lineHeight: 18 },
  footer: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  footerBtn: { flex: 1 },
  confirmInner: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  confirmLabel: { ...Type.body, fontWeight: "600" },
});
