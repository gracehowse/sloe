import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BookOpen } from "lucide-react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { EmptyState } from "@/components/EmptyState";

/**
 * ENG-788 (2026-05-30) — calm Plan empty state for users with zero saved
 * recipes, gated behind `plan_empty_state_v2` at the call site
 * (`app/(tabs)/planner.tsx`).
 *
 * Grace: "I dont know what happened here but it looks terrible." With
 * nothing saved the old card rendered the full day/start/meal config form
 * ending in a permanently-disabled 40%-opacity Generate button — a dead
 * end. There is nothing to plan with an empty library, so the only honest
 * action is "go build a library". This surfaces exactly that: a single
 * solid, ENABLED CTA into the recipe library, with the import path as a
 * quiet secondary for users migrating an existing plan.
 *
 * Extracted (rather than left inline) so it is unit-testable and
 * Storybook-able in isolation, and to nudge the oversized `planner.tsx`
 * screen toward the 400-line target (CLAUDE.md quality bar). Web parity:
 * `src/app/components/MealPlanner.tsx` `planner-empty-state`.
 */
export interface PlanEmptyStateProps {
  /** Navigate the user to the recipe library to start saving recipes. */
  onBrowseLibrary: () => void;
  /** Whether the `plan_import_enabled` flag is on — shows the secondary
   *  "import an existing plan" affordance when true. */
  planImportEnabled: boolean;
  /** Open the plan-import flow. Only reachable when `planImportEnabled`. */
  onImport: () => void;
}

export function PlanEmptyState({
  onBrowseLibrary,
  planImportEnabled,
  onImport,
}: PlanEmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <EmptyState
        illustration={<BookOpen size={30} color={Accent.primary} strokeWidth={1.75} />}
        title="Add a few recipes first"
        description="Save recipes you like and Suppr builds a balanced plan from them in seconds."
        cta={
          <View style={styles.ctaWrap}>
            <Pressable
              style={styles.primaryBtn}
              onPress={onBrowseLibrary}
              accessibilityRole="button"
              accessibilityLabel="Browse recipe library"
            >
              <Text style={styles.primaryBtnText}>Browse recipe library</Text>
            </Pressable>
            {planImportEnabled ? (
              <Pressable
                onPress={onImport}
                accessibilityRole="button"
                accessibilityLabel="Import existing meal plan"
                style={styles.importBtn}
              >
                <Text style={styles.importText}>Or import a plan you already have</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  ctaWrap: { alignItems: "center", gap: Spacing.sm },
  primaryBtn: {
    backgroundColor: Accent.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  importBtn: { paddingVertical: Spacing.xs },
  importText: { fontSize: 14, fontWeight: "600", color: Accent.primary },
});

export default PlanEmptyState;
