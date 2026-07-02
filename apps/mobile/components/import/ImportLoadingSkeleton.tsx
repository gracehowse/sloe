import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { SkeletonCard, SkeletonRow } from "@/components/ui/SkeletonRow";
import { useThemeColors } from "@/hooks/use-theme-colors";

type ImportLoadingSkeletonProps = {
  phase: "checking" | "importing";
  completedSteps?: Array<"ingredients" | "nutrition" | "macros">;
  onCancel?: () => void;
};

/**
 * Premium import loading — skeleton + honest status narration (ENG-606).
 * Replaces the centred large spinner on checking/importing states.
 */
export function ImportLoadingSkeleton({
  phase,
  completedSteps = [],
  onCancel,
}: ImportLoadingSkeletonProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the active-stage
  // status pill (tint, border, spinner, label). Completed step checks keep
  // `Accent.success`.
  const accent = useAccent();
  const STAGES = useMemo(
    () =>
      phase === "checking"
        ? [
            "Looking for a recipe link…",
            "Reading your clipboard…",
            "Preparing import…",
          ]
        : [
            "Extracting ingredients…",
            "Matching nutrition data…",
            "Calculating macros…",
          ],
    [phase],
  );
  const [stageIdx, setStageIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setStageIdx((i) => (i + 1) % STAGES.length);
    }, 1400);
    return () => clearInterval(t);
  }, [STAGES.length]);

  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlowLoad(true), 8_000);
    return () => clearTimeout(t);
  }, []);

  const stepLabels: Record<"ingredients" | "nutrition" | "macros", string> = {
    ingredients: "Extracting ingredients",
    nutrition: "Matching nutrition data",
    macros: "Calculating macros",
  };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={phase === "checking" ? "Checking for import link" : "Importing recipe"}
    >
      <SkeletonCard hero lines={2} style={{ marginBottom: Spacing.md }} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          padding: 14,
          borderRadius: Radius.md,
          backgroundColor: `${accent.primary}10`,
          borderWidth: 1,
          borderColor: `${accent.primary}26`,
          marginBottom: Spacing.md,
        }}
      >
        <ActivityIndicator size="small" color={accent.primary} />
        <Text
          style={{ flex: 1, fontSize: 13, fontWeight: "600", color: accent.primarySolid }}
          accessibilityLiveRegion="polite"
          testID="import-status-narration"
        >
          {STAGES[stageIdx]}
        </Text>
      </View>

      {phase === "importing" ? (
        <View style={{ gap: Spacing.md, marginBottom: Spacing.md }}>
          {(["ingredients", "nutrition", "macros"] as const).map((step) => {
            const isDone = completedSteps.includes(step);
            return (
              <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: Spacing.md }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: isDone ? Accent.success : colors.border,
                  }}
                >
                  {isDone ? <Ionicons name="checkmark" size={14} color={colors.primaryForeground} /> : null}
                </View>
                <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text }}>
                  {stepLabels[step]}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <SkeletonRow lines={2} />
        <SkeletonRow lines={2} />
        <SkeletonRow lines={1} thumb={false} />
      </View>

      {slowLoad ? (
        <Text
          style={{
            marginTop: Spacing.md,
            ...Type.captionSmall,
            color: colors.textSecondary,
            textAlign: "center",
          }}
        >
          Taking longer than usual — you can cancel and try again.
        </Text>
      ) : null}

      {onCancel ? (
        <Pressable
          onPress={onCancel}
          style={{ marginTop: Spacing.lg, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Cancel import"
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary }}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
