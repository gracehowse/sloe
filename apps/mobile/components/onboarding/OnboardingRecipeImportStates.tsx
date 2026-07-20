import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, RotateCcw } from "lucide-react-native";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ONBOARDING_RECIPE_IMPORT_PROGRESS,
  useOnboardingRecipeImport,
} from "@suppr/shared/onboarding/useOnboardingRecipeImport";

/**
 * ENG-1304 — importing/success states for `MobileOnboardingRecipeImportCard`,
 * split out to keep the parent under the 400-line screen budget.
 */
export function ImportProgress() {
  const colors = useThemeColors();
  const accent = useAccent();
  const steps = ONBOARDING_RECIPE_IMPORT_PROGRESS;
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(
      () => setCur((c) => Math.min(steps.length - 1, c + 1)),
      500,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <View
      style={{
        marginTop: Spacing.dense,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.inputBg,
        padding: Spacing.lg,
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color={accent.primaryLight} />
      <Text
        style={{
          ...Type.bodyLarge,
          fontWeight: "700",
          color: colors.text,
          marginVertical: Spacing.md,
        }}
      >
        Importing your recipe
      </Text>
      <View style={{ alignSelf: "stretch" }}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={{
              flexDirection: "row",
              gap: Spacing.sm,
              alignItems: "center",
              paddingVertical: Spacing.sm,
              opacity: i <= cur ? 1 : 0.35,
            }}
          >
            {i < cur ? (
              <Check size={14} color={Accent.successLight} />
            ) : (
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: Radius.full,
                  borderWidth: 1.5,
                  borderColor:
                    i === cur ? accent.primaryLight : colors.cardBorder,
                  backgroundColor:
                    i === cur ? accent.primarySoftStrong : "transparent",
                }}
              />
            )}
            <Text
              style={{
                ...Type.captionSmall,
                color: i <= cur ? colors.text : colors.textSecondary,
              }}
            >
              {s}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ImportSuccess({
  summary,
  onImportAnother,
}: {
  summary: NonNullable<ReturnType<typeof useOnboardingRecipeImport>["summary"]>;
  onImportAnother: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const meta = [
    summary.servings != null ? `${summary.servings} servings` : null,
    summary.totalMinutes != null ? `${summary.totalMinutes} min` : null,
    summary.sourceHost,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      style={{
        marginTop: Spacing.dense,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Accent.successLight, // ENG-1572 — solid Light, no alpha
        overflow: "hidden",
      }}
    >
      <View style={{ padding: Spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Check size={14} color={Accent.successLight} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 1,
              color: Accent.successLight,
            }}
          >
            Saved to your Library
          </Text>
        </View>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: colors.text,
            letterSpacing: -0.3,
            marginBottom: 4,
          }}
        >
          {summary.title}
        </Text>
        {meta ? (
          <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: Spacing.md }}>
            {meta}
          </Text>
        ) : null}
        {summary.calories != null ? (
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              paddingTop: Spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <MiniStat n={String(Math.round(summary.calories ?? 0))} u="kcal" />
            <MiniStat n={String(Math.round(summary.protein ?? 0))} u="P g" />
            <MiniStat n={String(Math.round(summary.carbs ?? 0))} u="C g" />
            <MiniStat n={String(Math.round(summary.fat ?? 0))} u="F g" />
          </View>
        ) : null}
        <Pressable
          onPress={onImportAnother}
          accessibilityRole="button"
          accessibilityLabel="Import another recipe"
          style={({ pressed }) => ({
            marginTop: Spacing.md,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <RotateCcw size={12} color={accent.primaryLight} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: accent.primaryLight }}>
            Import another
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MiniStat({ n, u }: { n: string; u: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          ...Type.bodyLarge,
          fontWeight: "700",
          color: colors.text,
          fontVariant: ["tabular-nums"],
          letterSpacing: -0.3,
        }}
      >
        {n}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: colors.textSecondary,
        }}
      >
        {u}
      </Text>
    </View>
  );
}
