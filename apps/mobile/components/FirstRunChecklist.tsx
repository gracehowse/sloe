import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";

const STORAGE_KEY = "suppr-checklist-dismissed";

type Props = {
  savedCount: number;
  hasPlan: boolean;
  hasLoggedMeal: boolean;
  onGoDiscover: () => void;
  onGoPlanner: () => void;
  onGoTracker: () => void;
};

export default function FirstRunChecklist({ savedCount, hasPlan, hasLoggedMeal, onGoDiscover, onGoPlanner, onGoTracker }: Props) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation();
  const [dismissed, setDismissed] = useState(true); // Hidden by default until loaded

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => setDismissed(v === "true"));
  }, []);

  const steps = [
    { label: "Save 3+ recipes", done: savedCount >= 3, action: onGoDiscover },
    { label: "Generate a meal plan", done: hasPlan, action: onGoPlanner },
    { label: "Log your first meal", done: hasLoggedMeal, action: onGoTracker },
  ];
  const allDone = steps.every((s) => s.done);

  useEffect(() => {
    if (allDone && !dismissed) {
      AsyncStorage.setItem(STORAGE_KEY, "true");
      setDismissed(true);
    }
  }, [allDone, dismissed]);

  const doneCount = steps.filter((s) => s.done).length;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: cardElevation.liftBg ?? colors.card, borderRadius: Radius.lg,
      borderWidth: cardElevation.useBorder ? 1 : 0, borderColor: Accent.success + "30",
      padding: Spacing.lg, gap: Spacing.md,
      ...(cardElevation.shadowStyle ?? {}),
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: 15, fontWeight: "700", color: colors.text },
    dismiss: { fontSize: 12, color: colors.textTertiary },
    progress: { height: 4, backgroundColor: colors.border, borderRadius: 2 },
    progressFill: { height: 4, backgroundColor: Accent.success, borderRadius: 2, width: `${(doneCount / steps.length) * 100}%` },
    step: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: 4 },
    stepText: { fontSize: 14, color: colors.text, flex: 1 },
    stepDone: { textDecorationLine: "line-through" as const, color: colors.textTertiary },
  }), [colors, doneCount, cardElevation]);

  if (dismissed) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Get started</Text>
        <Pressable onPress={() => { setDismissed(true); AsyncStorage.setItem(STORAGE_KEY, "true"); }}>
          <Text style={styles.dismiss}>Dismiss</Text>
        </Pressable>
      </View>
      <View style={styles.progress}>
        <View style={styles.progressFill} />
      </View>
      {steps.map((s, i) => (
        <Pressable key={i} style={styles.step} onPress={s.done ? undefined : s.action}>
          <Ionicons name={s.done ? "checkmark-circle" : "ellipse-outline"} size={20} color={s.done ? Accent.success : colors.textTertiary} />
          <Text style={[styles.stepText, s.done && styles.stepDone]}>{s.label}</Text>
          {!s.done && <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />}
        </Pressable>
      ))}
    </View>
  );
}
