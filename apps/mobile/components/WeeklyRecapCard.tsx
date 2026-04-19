/**
 * WeeklyRecapCard — mobile (Batch 4.11).
 *
 * Mirrors the web `suppr/weekly-recap-card.tsx`. All labels, stats, and
 * share copy come from the shared pure helper
 * `src/lib/nutrition/weeklyRecap.ts` so web and mobile cannot drift.
 *
 * Rules:
 *   - Supportive, factual copy (no shame phrasing).
 *   - Share button labelled; dismiss button labelled.
 *   - Weight delta suppressed when <2 weigh-ins.
 *   - Card uses an accessibility role of "header" for the headline so
 *     screen readers announce a heading level.
 */

import { useCallback, useMemo } from "react";
import { Share, View, Text, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import { formatRecapForShare, type WeeklyRecap } from "@/lib/weeklyRecap";
import type { UsualMealRecapInsight } from "../../../src/lib/nutrition/weeklyRecap";
import { selectMostFrequentSlotSeed } from "../../../src/lib/nutrition/usualMealHint";
import type { FoodHistoryMealLike } from "../../../src/lib/nutrition/foodHistory";
import type { SavedMealItem } from "../../../src/lib/nutrition/savedMeals";
import {
  formatMaintenanceRecapLine,
  type ResolvedMaintenance,
} from "../../../src/lib/nutrition/resolveMaintenance";
import { Radius as RadiusTokens } from "@/constants/theme";

/** Loose journal-meal shape accepted by the save-prompt deep-link.
 *  Narrow enough that both `JournalMeal` (mobile) and `LoggedMeal` (web)
 *  fit without adapters. Kept in sync with the web card. */
type RecapSaveSeedMeal = FoodHistoryMealLike & { name?: string | null };

export interface WeeklyRecapCardProps {
  recap: WeeklyRecap;
  onDismiss: () => void;
  /** Ship M1 — usual-meal growth-loop insight. Null skips the line. */
  usualMealInsight?: UsualMealRecapInsight;
  /** Ship M1 — fallback CTA handler (route to Today) when the deep-link
   * seed isn't available. Still used by the card when `byDay` +
   * `onOpenSaveCombo` aren't supplied, or when the helper returns null. */
  onStartUsualMealSave?: (slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks") => void;
  /** Post-ship #4 — journal map so the card can compute pre-seeded
   * items for the save-prompt deep-link. When supplied alongside
   * `onOpenSaveCombo`, the CTA opens `SaveMealSheet` pre-filled with
   * the user's most-frequent items. When the helper returns null the
   * card falls back to `onStartUsualMealSave`. */
  byDay?: Record<string, RecapSaveSeedMeal[]>;
  /** Post-ship #4 — deep-link handler; receives the helper-picked slot
   * and the pre-seeded items. Same shape as the host's existing
   * `openSaveMealSheetForSlot(slot, seedItems)` wrapper. */
  onOpenSaveCombo?: (
    slot: "Breakfast" | "Lunch" | "Dinner" | "Snacks",
    seedItems: Array<Omit<SavedMealItem, "id" | "position">>,
  ) => void;
  /**
   * Action 5 Item 7 (2026-04-19) — resolved maintenance for the week.
   * When `formatMaintenanceRecapLine` returns a non-null string the
   * card surfaces a one-line "Your maintenance landed at X kcal this
   * week (formula said Y)." between the stat row and the share button.
   * Suppressed for formula-fallback / low confidence / matching values.
   * Identical contract on web (`suppr/weekly-recap-card.tsx`).
   */
  maintenance?: ResolvedMaintenance | null;
}

export function WeeklyRecapCard({
  recap,
  onDismiss,
  usualMealInsight,
  onStartUsualMealSave,
  byDay,
  onOpenSaveCombo,
  maintenance,
}: WeeklyRecapCardProps) {
  const colors = useThemeColors();
  const shareText = useMemo(() => formatRecapForShare(recap), [recap]);
  // Action 5 Item 7 — adaptive-vs-formula one-liner. `null` when the
  // line should not render (formula fallback, low confidence, or values
  // identical). Memoised so referential equality keeps React quiet.
  const maintenanceLine = useMemo(
    () => formatMaintenanceRecapLine(maintenance),
    [maintenance],
  );

  const handleShare = useCallback(async () => {
    track(AnalyticsEvents.weekly_recap_shared, {
      weekKey: recap.weekKey,
      platform: Platform.OS,
    });
    try {
      await Share.share({
        message: shareText,
      });
    } catch {
      // User cancelled or sheet failed — no toast needed.
    }
  }, [recap.weekKey, shareText]);

  const handleDismiss = useCallback(() => {
    track(AnalyticsEvents.weekly_recap_dismissed, { weekKey: recap.weekKey });
    onDismiss();
  }, [onDismiss, recap.weekKey]);

  /**
   * Post-ship #4 — pre-compute the save-prompt seed once per render so
   * the prompt copy and CTA label reflect the slot the sheet will open
   * with. Mirrors the web card.
   */
  const saveSeed = useMemo(() => {
    if (!byDay) return null;
    const suggested =
      usualMealInsight?.kind === "prompt" ? usualMealInsight.suggestedSlot : null;
    return selectMostFrequentSlotSeed(byDay, suggested);
  }, [byDay, usualMealInsight]);

  /** Slot label the prompt renders — prefers the deep-link seed's slot
   *  so the dialog and copy agree. Falls back to the insight's
   *  suggested slot for legacy callers that don't pass `byDay`. */
  const promptDisplaySlot: "Breakfast" | "Lunch" | "Dinner" | "Snacks" | null =
    usualMealInsight?.kind === "prompt"
      ? saveSeed?.slot ?? usualMealInsight.suggestedSlot
      : null;

  /**
   * Post-ship #4 — CTA handler for "Save {slot} as a meal". Prefers the
   * deep-link path (pre-seeded save sheet) when `byDay` +
   * `onOpenSaveCombo` are wired; falls back to route-to-Today when the
   * helper returns null or the host didn't wire the deep-link props.
   */
  const handleStartUsualMealSave = useCallback(
    (suggestedSlot: "Breakfast" | "Lunch" | "Dinner" | "Snacks") => {
      if (saveSeed && onOpenSaveCombo && saveSeed.seedItems.length >= 2) {
        const items: Array<Omit<SavedMealItem, "id" | "position">> = saveSeed.seedItems.map(
          (it) => {
            const row: Omit<SavedMealItem, "id" | "position"> = {
              recipeTitle: it.recipeTitle,
              calories: it.calories,
              protein: it.protein,
              carbs: it.carbs,
              fat: it.fat,
              portionMultiplier: 1,
            };
            if (it.fiber != null) row.fiber = it.fiber;
            if (it.source) row.source = it.source;
            return row;
          },
        );
        try {
          track(AnalyticsEvents.weekly_recap_save_prompt_tapped, {
            slot: saveSeed.slot,
            seedCount: items.length,
          });
        } catch {
          /* analytics fire-and-forget */
        }
        onOpenSaveCombo(saveSeed.slot, items);
        return;
      }
      if (onStartUsualMealSave) onStartUsualMealSave(suggestedSlot);
    },
    [saveSeed, onOpenSaveCombo, onStartUsualMealSave],
  );

  const hasWeight = recap.weightDeltaKg != null;
  const weightCopy = hasWeight
    ? `${recap.weightDeltaKg! > 0 ? "+" : ""}${recap.weightDeltaKg} kg`
    : "No weigh-ins this week";
  // Action 13 Item #13 (2026-04-19) — explicit "First → Last weigh-in"
  // copy; mirrors web. Suppressed when both endpoints aren't present.
  const weightFirstLastLine =
    recap.weightFirstKg != null &&
    recap.weightLastKg != null &&
    recap.weightDeltaKg != null
      ? `First → Last weigh-in: ${recap.weightFirstKg} → ${recap.weightLastKg} kg (${
          recap.weightDeltaKg > 0 ? "+" : ""
        }${recap.weightDeltaKg} kg)`
      : null;

  return (
    <View
      accessible={false}
      style={{
        backgroundColor: colors.card,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: Spacing.lg,
        marginBottom: 14,
      }}
      testID="weekly-recap-card"
    >
      {/* Dismiss */}
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss weekly recap"
        hitSlop={8}
        style={{ position: "absolute", right: 12, top: 12, padding: 4 }}
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Ionicons name="trophy-outline" size={14} color={Accent.success} />
        <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.success, letterSpacing: 1 }}>
          WEEK RECAP
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 2 }}
      >
        Your week — {recap.weekLabel}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 14 }}>
        {recap.daysLogged} day{recap.daysLogged === 1 ? "" : "s"} logged
      </Text>

      {/* Stat grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Stat label="Avg calories" value={`${recap.avgCalories}`} hint="per day" />
        <Stat
          label="Avg protein"
          value={`${recap.avgProtein}g`}
          hint={
            recap.proteinAdherencePct > 0
              ? `${recap.proteinAdherencePct}% of target`
              : "no target set"
          }
        />
        <Stat
          label="Streak"
          value={`${recap.streakLength}`}
          hint={
            recap.freezesAvailable > 0
              ? `day${recap.streakLength === 1 ? "" : "s"} · ${recap.freezesAvailable} freeze${recap.freezesAvailable === 1 ? "" : "s"}`
              : `day${recap.streakLength === 1 ? "" : "s"}`
          }
        />
        <Stat
          label="Weight"
          value={weightCopy}
          hint={hasWeight ? "first → last weigh-in" : "log weight any day"}
          muted={!hasWeight}
        />
      </View>

      {/* Action 13 Item #13 (2026-04-19) — explicit "First → Last
          weigh-in" line. Replaces the implicit "change this week"
          framing — naming it lets the user discount water/glycogen
          noise rather than read the number as an average. */}
      {weightFirstLastLine ? (
        <Text
          testID="weekly-recap-weight-first-last"
          style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}
        >
          {weightFirstLastLine}
        </Text>
      ) : null}

      {recap.bestDay ? (
        /* Action 13 Item #9 (2026-04-19) — relabelled from "Best day"
           (highest protein) to "Closest to target" (smallest summed
           L1 deviation across logged macros). Field name in the recap
           type stays `bestDay` for back-compat with share + analytics. */
        <Text
          testID="weekly-recap-closest-to-target"
          style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}
        >
          Closest to target —{" "}
          <Text style={{ fontWeight: "700", color: colors.text }}>{recap.bestDay.label}</Text>
          {" · "}
          {recap.bestDay.protein}g protein, {recap.bestDay.calories} kcal
        </Text>
      ) : null}

      {/* Ship M1 — usual meals growth-loop line. */}
      {usualMealInsight?.kind === "celebration" ? (
        <Text
          style={{ fontSize: 12, color: colors.text, marginBottom: 10 }}
          accessibilityLabel={`You logged ${usualMealInsight.name} ${usualMealInsight.count} time${
            usualMealInsight.count === 1 ? "" : "s"
          } this week`}
        >
          You logged <Text style={{ fontWeight: "700" }}>{usualMealInsight.name}</Text>{" "}
          {usualMealInsight.count} time{usualMealInsight.count === 1 ? "" : "s"} this week.
        </Text>
      ) : null}
      {usualMealInsight?.kind === "prompt" && promptDisplaySlot ? (
        <View
          style={{
            padding: 12,
            marginBottom: 10,
            borderRadius: RadiusTokens.md,
            backgroundColor: Accent.primary + "0D",
            borderWidth: 1,
            borderColor: Accent.primary + "40",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
            Got a usual {promptDisplaySlot.toLowerCase()}?
          </Text>
          {/* Action 5 Item 8 (2026-04-19) — when the loosened gate fires
              the helper passes `repeats`; surface the concrete count.
              Falls back to the generic "save once, log in one tap"
              copy for the original zero-saved-meals path. */}
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
            {usualMealInsight.repeats && usualMealInsight.repeats >= 3
              ? `You've logged the same one ${usualMealInsight.repeats} times in 2 weeks.`
              : "Save it once, log it in one tap."}
          </Text>
          {onStartUsualMealSave || onOpenSaveCombo ? (
            <Pressable
              onPress={() => handleStartUsualMealSave(promptDisplaySlot)}
              accessibilityRole="button"
              accessibilityLabel={`Save ${promptDisplaySlot} as a usual meal`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                alignSelf: "flex-start",
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: RadiusTokens.sm,
                backgroundColor: Accent.primary,
              }}
            >
              <Ionicons name="bookmark-outline" size={12} color="#fff" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
                Save {promptDisplaySlot} as a meal
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Action 5 Item 7 (2026-04-19) — adaptive-vs-formula one-liner.
          Suppressed unless adaptive won and differs from formula. */}
      {maintenanceLine ? (
        <Text
          testID="weekly-recap-maintenance-line"
          style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}
        >
          {maintenanceLine}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share weekly recap"
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: Accent.success + "18",
            borderWidth: 1,
            borderColor: Accent.success + "30",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="share-outline" size={14} color={Accent.success} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.success }}>
            Share week
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss weekly recap and continue"
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        padding: 10,
        borderRadius: 10,
        backgroundColor: colors.cardBorder + "22",
        borderWidth: 1,
        borderColor: colors.cardBorder,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 1,
          marginBottom: 2,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: muted ? colors.textSecondary : colors.text,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {hint ? (
        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 1 }}>{hint}</Text>
      ) : null}
    </View>
  );
}
