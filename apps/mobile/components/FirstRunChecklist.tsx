import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Target,
  Utensils,
  X,
} from "lucide-react-native";
import { Accent, FontWeight, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { PressableScale } from "@/components/ui/PressableScale";
import { CARD_RADIUS } from "@/components/ui/SupprCard";

const STORAGE_KEY = "suppr-checklist-dismissed";

type Props = {
  savedCount: number;
  hasPlan: boolean;
  hasLoggedMeal: boolean;
  onGoDiscover: () => void;
  onGoPlanner: () => void;
  onGoTracker: () => void;
};

export default function FirstRunChecklist({
  savedCount,
  hasPlan,
  hasLoggedMeal,
  onGoDiscover,
  onGoPlanner,
  onGoTracker,
}: Props) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation({ variant: "soft" });
  const [dismissed, setDismissed] = useState(true); // Hidden by default until loaded

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => setDismissed(v === "true"));
  }, []);

  const steps = useMemo(
    () => [
      { label: "Log your first meal", done: hasLoggedMeal, action: onGoTracker, icon: Target },
      {
        label: "Generate a meal plan",
        done: hasPlan,
        action: onGoPlanner,
        icon: CheckCircle2,
      },
      {
        label: "Save 3+ recipes",
        done: savedCount >= 3,
        action: onGoDiscover,
        icon: Utensils,
      },
    ],
    [hasLoggedMeal, hasPlan, onGoDiscover, onGoPlanner, onGoTracker, savedCount],
  );
  const allDone = steps.every((s) => s.done);
  const nextStep = steps.find((s) => !s.done);

  useEffect(() => {
    if (allDone && !dismissed) {
      AsyncStorage.setItem(STORAGE_KEY, "true");
      setDismissed(true);
    }
  }, [allDone, dismissed]);

  const doneCount = steps.filter((s) => s.done).length;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: cardElevation.liftBg ?? colors.card,
      borderRadius: CARD_RADIUS,
      borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
      borderColor: colors.cardBorder,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...(cardElevation.shadowStyle ?? {}),
    },
    row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.dense },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: Radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Accent.primarySoft,
    },
    content: { flex: 1, minWidth: 0 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: Spacing.sm,
    },
    title: { ...Type.body, fontWeight: FontWeight.bold, color: colors.text },
    meta: { ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs },
    dismiss: { padding: Spacing.xs, borderRadius: Radius.sm },
    progress: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: Radius.full,
      overflow: "hidden",
      marginTop: Spacing.dense,
    },
    progressFill: {
      height: 4,
      backgroundColor: Accent.success,
      borderRadius: Radius.full,
      width: `${(doneCount / steps.length) * 100}%`,
    },
    step: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
      paddingVertical: Spacing.dense,
      paddingHorizontal: Spacing.sm,
      borderRadius: Radius.md,
      marginTop: Spacing.sm,
    },
    stepText: { ...Type.body, color: colors.text, flex: 1 },
  }), [colors, doneCount, cardElevation, steps.length]);

  if (dismissed || !nextStep) return null;

  const NextIcon = nextStep.icon;

  return (
    <View style={styles.card} accessibilityLabel="Getting Started">
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <NextIcon size={16} color={Accent.primary} strokeWidth={2.25} />
        </View>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Getting Started</Text>
              <Text style={styles.meta}>
                {doneCount} of {steps.length} complete
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setDismissed(true);
                AsyncStorage.setItem(STORAGE_KEY, "true");
              }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss checklist"
              hitSlop={Spacing.sm}
              style={styles.dismiss}
            >
              <X size={16} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>
          <View style={styles.progress}>
            <View style={styles.progressFill} />
          </View>
          <PressableScale
            haptic="selection"
            style={styles.step}
            onPress={nextStep.action}
            accessibilityRole="button"
            accessibilityLabel={nextStep.label}
          >
            <Circle size={16} color={colors.textTertiary} strokeWidth={2} />
            <Text style={styles.stepText}>{nextStep.label}</Text>
            <ChevronRight
              size={16}
              color={colors.textTertiary}
              strokeWidth={2.25}
            />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}
