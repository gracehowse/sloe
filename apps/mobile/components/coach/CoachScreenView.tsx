import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Info, Sparkles } from "lucide-react-native";

import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { QuickLogButton } from "@/components/ui/QuickLogButton";
import { SupprCard } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";
import {
  coachEmptyStateCopy,
  type CoachCandidate,
} from "@suppr/nutrition-core/mealCoach";
import {
  COACH_ASK_CHIPS,
  type CoachAskChipId,
} from "@suppr/nutrition-core/coachAsk";
import { formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";

export interface CoachScreenViewProps {
  narrative: string;
  narrativeLoading?: boolean;
  candidates: readonly CoachCandidate[];
  candidatesRefining?: boolean;
  onCandidatePress?: (recipeId: string) => void;
  /** Saved-recipe library size — distinguishes the over-budget empty state
   *  from the genuinely-no-recipes one (ENG-1294). */
  librarySize: number;
  /** Remaining calories for the day (≤ 0 when at/over target). */
  remainingCalories: number;
  /** ENG-1301 (VERIFIED V13) — compact secondary "Log": one-tap logs the
   *  candidate to the suggested slot via the host's existing quick-log
   *  insert helper. The row press keeps routing to the recipe. */
  onCandidateLog?: (recipeId: string) => Promise<void> | void;
  selectedChipId: CoachAskChipId | null;
  askAnswer: string | null;
  askLoading: boolean;
  onAskChip: (chipId: CoachAskChipId) => void;
}

function CoachCandidateRow({
  candidate,
  isBest,
  onPress,
  onLog,
}: {
  candidate: CoachCandidate;
  isBest: boolean;
  onPress?: () => void;
  onLog?: () => Promise<void> | void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const content = (
    <View style={{ flexDirection: "row", gap: Spacing.md, alignItems: "center" }}>
      {candidate.thumbnail ? (
        <SmartImage
          source={{ uri: candidate.thumbnail }}
          style={{ width: 52, height: 52, borderRadius: 12 }}
        />
      ) : (
        // RecipeHeroFallback absolute-fills its parent (hero-slot semantics) —
        // row thumbs give it a fixed-size wrapper, same idiom as
        // DiscoverMoreIdeaRow / RecipeDetailHero.
        <View style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden" }}>
          <RecipeHeroFallback id={candidate.recipeId} title={candidate.title} iconSize={20} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm }}>
          <Text style={{ ...Type.body, color: colors.text, flex: 1 }} numberOfLines={2}>
            {candidate.title}
          </Text>
          {isBest ? (
            // Sanctioned soft-tint badge pair (`accent.primarySoft` fill +
            // `accent.primarySolid` label — theme-aware, AA in dark; same as
            // the QuickAddPanel / selected-pill siblings). The old
            // tint-on-fillQuiet pair measured 1.79:1 in dark. ENG-1294.
            <Text
              style={{
                ...Type.caption,
                color: accent.primarySolid,
                backgroundColor: accent.primarySoft,
                paddingHorizontal: Spacing.sm,
                paddingVertical: Spacing.xs,
                borderRadius: 9999,
                overflow: "hidden",
                textTransform: "uppercase",
                fontWeight: "700",
              }}
            >
              Best fit
            </Text>
          ) : null}
        </View>
        <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs }}>
          {/* ENG-1305: predictedCalories/Protein are Coach's own derived
              estimate (mealCoach.ts: "OUR numbers, never the model's"), not a
              verified match — mark it "~" like every other predicted-meal
              kcal display (planner.tsx, SwapMealSheet.tsx), and use the
              locale-independent formatter instead of bare .toLocaleString(). */}
          ~{formatKcalDisplay(candidate.predictedCalories)} kcal · {candidate.predictedProtein}g protein
        </Text>
        {candidate.whyLine ? (
          <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs }}>
            {candidate.whyLine}
          </Text>
        ) : null}
      </View>
      {/* ENG-1301 — compact secondary Log (ghost). Nested pressable wins the
          touch, so the row's recipe press stays intact around it. */}
      {onLog ? (
        <QuickLogButton
          testID={`coach-candidate-log-${candidate.recipeId}`}
          onLog={onLog}
          accessibilityLabel={`Log ${candidate.title}`}
        />
      ) : null}
    </View>
  );

  // Row chrome — explicit soft-lift page-ground treatment (`lift="soft"`,
  // 16px padding via the `padding` prop), matching the Today content-card
  // siblings (TodayActivityCard et al.) and web's `elevation="card"`. The old
  // `style={{ padding }}` landed on the OUTER wrapper and stacked with the
  // card-size default inner padding. ENG-1294.
  if (onPress) {
    return (
      <PressableScale onPress={onPress} haptic="selection" style={{ width: "100%" }}>
        <SupprCard lift="soft" padding="md">{content}</SupprCard>
      </PressableScale>
    );
  }

  return <SupprCard lift="soft" padding="md">{content}</SupprCard>;
}

export function CoachScreenView({
  narrative,
  narrativeLoading,
  candidates,
  candidatesRefining,
  onCandidatePress,
  librarySize,
  remainingCalories,
  onCandidateLog,
  selectedChipId,
  askAnswer,
  askLoading,
  onAskChip,
}: CoachScreenViewProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  return (
    <ScrollView
      testID="coach-screen"
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xl * 2, gap: Spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Digest card — explicit soft-lift page-ground treatment
          (`lift="soft" padding="lg"`), matching the Today content-card
          siblings (TodayActivityCard) and web's `elevation="card"
          padding="xl"`. ENG-1294. */}
      <SupprCard lift="soft" padding="lg" innerStyle={{ gap: Spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ ...Type.label, color: colors.textSecondary }}>Today&apos;s read</Text>
          {/* Sanctioned soft-tint badge pair — see the Best-fit chip note.
              ENG-1294 (was tint-on-fillQuiet, 1.79:1 in dark). */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.xs,
              backgroundColor: accent.primarySoft,
              paddingHorizontal: Spacing.sm,
              paddingVertical: Spacing.xs,
              borderRadius: 9999,
            }}
          >
            <Sparkles size={12} color={accent.primarySolid} />
            <Text style={{ ...Type.caption, color: accent.primarySolid, fontWeight: "600" }}>Coach</Text>
          </View>
        </View>
        {narrativeLoading ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Text style={{ ...Type.headline, color: colors.text }}>
            {narrative}
          </Text>
        )}
      </SupprCard>

      <View style={{ gap: Spacing.sm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ ...Type.headline, color: colors.text }}>What to eat next</Text>
          <Text style={{ ...Type.caption, color: colors.textSecondary }}>from your cookbook</Text>
        </View>
        {candidates.length === 0 ? (
          <Text style={{ ...Type.body, color: colors.textSecondary }}>
            {coachEmptyStateCopy({ librarySize, remainingCalories })}
          </Text>
        ) : (
          candidates.map((c, i) => (
            <CoachCandidateRow
              key={c.recipeId}
              candidate={c}
              isBest={i === 0}
              onPress={onCandidatePress ? () => onCandidatePress(c.recipeId) : undefined}
              onLog={onCandidateLog ? () => onCandidateLog(c.recipeId) : undefined}
            />
          ))
        )}
        {candidatesRefining ? (
          <Text style={{ ...Type.caption, color: colors.textSecondary }}>Refining order…</Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" }}>
          <Info size={14} color={colors.textSecondary} style={{ marginTop: Spacing.xs }} />
          <Text style={{ ...Type.caption, color: colors.textSecondary, flex: 1 }}>
            Ranked from your saved recipes against what&apos;s left today. Numbers are always your own.
          </Text>
        </View>
      </View>

      <View style={{ gap: Spacing.sm }}>
        <Text style={{ ...Type.headline, color: colors.text }}>Ask the coach</Text>
        <View style={{ gap: Spacing.sm, alignItems: "flex-start" }}>
          {COACH_ASK_CHIPS.map((chip) => (
            // 16px/8px chip step + body-size (14px) label — snapped to the
            // same scale web's ask chips use (px-4 / py-2 / text-sm).
            // Selected fill is the sanctioned `accent.primarySoft` pair
            // (selected-pill siblings: QuickAddPanel / MealTypePicker) —
            // `fillQuiet` fails contrast under a tinted label in dark.
            // Routed through PressableScale (pressed state ships with the
            // element). ENG-1294.
            <PressableScale
              key={chip.id}
              haptic="selection"
              disabled={askLoading && selectedChipId === chip.id}
              onPress={() => onAskChip(chip.id)}
              style={{
                borderWidth: 1,
                borderColor:
                  selectedChipId === chip.id ? accent.primarySolid : colors.cardBorder,
                backgroundColor:
                  selectedChipId === chip.id ? accent.primarySoft : colors.card,
                borderRadius: 9999,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
              }}
            >
              <Text style={{ ...Type.body, color: colors.text }}>{chip.label}</Text>
            </PressableScale>
          ))}
        </View>
        {askLoading ? (
          <Text style={{ ...Type.body, color: colors.textSecondary }}>Coach is thinking…</Text>
        ) : askAnswer ? (
          <SupprCard lift="soft" padding="lg">
            <Text style={{ ...Type.body, color: colors.text }}>{askAnswer}</Text>
          </SupprCard>
        ) : null}
        <Text style={{ ...Type.caption, color: colors.textSecondary }}>
          Sloe is a tracking tool, not a medical or dietary advisor.
        </Text>
      </View>
    </ScrollView>
  );
}
