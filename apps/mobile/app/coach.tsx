import { Redirect, Stack, useRouter, type Href } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Spacing, Type } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { useCoach } from "@/lib/useCoach";
import { useSavedLibraryRecipes } from "@/lib/recipes";

export default function CoachScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { recipes } = useSavedLibraryRecipes(userId);

  if (!isFeatureEnabled("coach_full_screen_v1")) {
    return <Redirect href="/(tabs)" />;
  }

  const library = useMemo(
    () =>
      recipes.map((r) => ({
        id: r.id,
        title: r.title,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        imageUrl: r.image ?? null,
      })),
    [recipes],
  );

  const coach = useCoach({
    library,
    remaining: { calories: 600, protein: 40, carbs: 60, fat: 20, dailyCalorieTarget: 2000 },
    enabled: library.length > 0,
  });

  return (
    <>
      <Stack.Screen options={{ title: "Coach" }} />
      <ScrollView
        contentContainerStyle={[styles.content, { backgroundColor: colors.background }]}
      >
        <Text style={[Type.title, { color: colors.text }]}>Coach</Text>
        <Text style={[Type.body, styles.sub, { color: colors.textSecondary }]}>
          Ranked ideas for what to eat next.
        </Text>
        {coach.candidates.map((c) => (
          <PressableScale
            key={c.recipeId}
            haptic="confirm"
            onPress={() => router.push(`/recipe/${c.recipeId}` as Href)}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <Text style={[Type.body, { color: colors.text, fontWeight: "600" }]}>{c.title}</Text>
            {c.whyLine ? (
              <Text style={[Type.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
                {c.whyLine}
              </Text>
            ) : null}
          </PressableScale>
        ))}
        {coach.candidates.length === 0 ? (
          <Text style={[Type.caption, { color: colors.textTertiary }]}>
            Save recipes to your library to get coach picks.
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sub: {
    marginBottom: Spacing.sm,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: Spacing.md,
  },
});
