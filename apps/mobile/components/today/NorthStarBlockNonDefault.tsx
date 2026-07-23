import { StyleSheet, Text, View } from "react-native";
import { ChevronRight, Sparkles } from "lucide-react-native";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  resolveOverBudgetCaption,
  type OverBudgetStage,
} from "@suppr/nutrition-core/coachOverBudgetStage";

import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";
import { SupprCard } from "@/components/ui/SupprCard";
import { SupprNotice } from "@/components/ui/SupprNotice";

import type { NorthStarKind } from "@/components/today/NorthStarBlock";

/**
 * The five non-`default` `<NorthStarBlock>` state branches, extracted so
 * `NorthStarBlock.tsx` stays under its screen-line-budget pin (mirrors the
 * existing `NorthStarFigmaHero` extraction for the `default` branch, and the
 * web `north-star-block-non-default.tsx` extraction of the same five
 * branches). Presentation-only; `NorthStarBlock` decides which branch to
 * render.
 *
 * Web mirror: `src/app/components/suppr/north-star-block-non-default.tsx`.
 */
export interface NorthStarBlockNonDefaultProps {
  kind: Exclude<NorthStarKind, "default">;
  testID?: string;
  overBudgetStage?: OverBudgetStage;
  overBudgetCalories?: { consumed: number; goal: number };
  underEatingLine?: string;
  onOpenLibrary?: () => void;
  onBrowse?: () => void;
}

export function NorthStarBlockNonDefault({
  kind,
  testID,
  overBudgetStage: stage,
  overBudgetCalories,
  underEatingLine,
  onOpenLibrary,
  onBrowse,
}: NorthStarBlockNonDefaultProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the Browse link +
  // the library-empty sparkle.
  const accent = useAccent();

  if (kind === "over-budget") {
    return (
      <View
        testID={testID ?? "north-star-over-budget"}
        accessibilityRole="text"
        style={{ paddingHorizontal: Spacing.xs, paddingVertical: Spacing.sm }}
      >
        <Text style={[Type.caption, { color: colors.textSecondary }]}>
          {resolveOverBudgetCaption(isFeatureEnabled("coaching_stages_v1"), stage, overBudgetCalories)}
        </Text>
      </View>
    );
  }

  if (kind === "under-eating") {
    // ENG-1454 — host resolves the ED-safe line; no copy → render nothing
    // (no legacy predecessor for this kind, unlike over-budget).
    if (!underEatingLine) return null;
    return (
      <View
        testID={testID ?? "north-star-under-eating"}
        accessibilityRole="text"
        style={{ paddingHorizontal: Spacing.xs, paddingVertical: Spacing.sm }}
      >
        <Text style={[Type.caption, { color: colors.textSecondary }]}>{underEatingLine}</Text>
      </View>
    );
  }

  if (kind === "new-user") {
    return (
      <SupprCard
        // Recipe-tier flat (Grace 2026-06-09 one-treatment, superseded by ENG-1099 flat).
        lift="flat"
        testID={testID ?? "north-star-new-user"}
        tone="primary"
        padding="md"
        innerStyle={styles.row}
      >
        <Sparkles size={IconSize.lg} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[Type.body, { color: colors.text, fontWeight: "600" }]}>
            {"Log your first meal — suggestions get smarter once we've seen you eat."}
          </Text>
        </View>
      </SupprCard>
    );
  }

  if (kind === "library-empty") {
    // ENG-1662 — under `ui_anatomy_owners_v1` this is a SupprNotice (system
    // speaking, radius 24 quiet fill). Flag-off keeps the legacy radius-8
    // hand-rolled row (kill switch).
    if (isFeatureEnabled("ui_anatomy_owners_v1")) {
      return (
        <PressableScale
          testID={testID ?? "north-star-library-empty"}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel="Pick recipes for your library"
          onPress={onOpenLibrary}
        >
          <SupprNotice
            tone="primary"
            variant="block"
            leading={<Sparkles size={IconSize.lg} color={accent.primarySolid} />}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Text style={[Type.body, { color: colors.text, fontWeight: "600", flex: 1 }]}>
                {"Pick a few recipes — we'll suggest from there."}
              </Text>
              <ChevronRight size={IconSize.lg} color={colors.textSecondary} />
            </View>
          </SupprNotice>
        </PressableScale>
      );
    }
    // 2026-05-23 — flattened from a primary-tinted SupprCard with a
    // separate solid CTA pill into a single tappable inset row with a
    // chevron. Same grammar as the Discover "Import from TikTok" row
    // and the Today section dividers — much quieter, doesn't compete
    // with the meal slots above. The whole row is the tap target.
    return (
      <PressableScale
        testID={testID ?? "north-star-library-empty"}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Pick recipes for your library"
        onPress={onOpenLibrary}
        style={[styles.libraryEmptyRow, { backgroundColor: colors.fillQuiet }]}
      >
        {/* ENG-1198: this is a real north-star entry point, not placeholder
            text. Sparkle → primarySolid (accent "feature, tap me" signal),
            chevron → textSecondary (one step up from tertiary, not primary),
            and the row sits in a quiet-fill affordance (styles.libraryEmptyRow)
            so it reads as a tappable pill, matching the meal-card "Add food"
            grammar. Previously both icons rendered in textTertiary with no
            fill, so the row read as disabled/greyed-out. */}
        <Sparkles size={18} color={accent.primarySolid} />
        <Text
          style={[
            Type.body,
            { color: colors.textSecondary, flex: 1, fontSize: 14 },
          ]}
        >
          {"Pick a few recipes — we'll suggest from there."}
        </Text>
        <ChevronRight size={18} color={colors.textSecondary} />
      </PressableScale>
    );
  }

  // kind === "no-fit"
  return (
    <SupprCard
      // Recipe-tier flat (Grace 2026-06-09 one-treatment, superseded by ENG-1099 flat).
      lift="flat"
      testID={testID ?? "north-star-no-fit"}
      tone="neutral"
      padding="md"
      innerStyle={styles.row}
    >
      <Text style={[Type.body, { color: colors.textSecondary, flex: 1 }]}>
        Library has nothing under your remaining macros today.
      </Text>
      <PressableScale
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Browse"
        onPress={onBrowse}
        hitSlop={6}
      >
        <Text
          style={[
            Type.caption,
            { color: accent.primarySolid, fontWeight: "700" },
          ]}
        >
          Browse →
        </Text>
      </PressableScale>
    </SupprCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  libraryEmptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.dense,
    // ENG-1198: quiet-fill affordance so the north-star entry reads as a
    // tappable pill, not greyed placeholder text. Padding bumped 4 → dense (12)
    // so the fill has room to breathe; radius = Radius.lg (8). backgroundColor
    // is applied inline from `colors.fillQuiet` (theme-aware light/dark) at the
    // call sites — it can't live in this static StyleSheet.
    paddingHorizontal: Spacing.dense,
    paddingVertical: Spacing.dense,
    borderRadius: Radius.lg,
  },
});

export default NorthStarBlockNonDefault;
