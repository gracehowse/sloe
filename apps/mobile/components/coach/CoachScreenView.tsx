import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Info, Sparkles } from "lucide-react-native";

import { Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprCard } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { SmartImage } from "@/components/ui/SmartImage";
import type { CoachCandidate } from "@suppr/nutrition-core/mealCoach";
import {
  COACH_ASK_CHIPS,
  type CoachAskChipId,
} from "@suppr/nutrition-core/coachAsk";

export interface CoachScreenViewProps {
  narrative: string;
  narrativeLoading?: boolean;
  candidates: readonly CoachCandidate[];
  candidatesRefining?: boolean;
  onCandidatePress?: (recipeId: string) => void;
  selectedChipId: CoachAskChipId | null;
  askAnswer: string | null;
  askLoading: boolean;
  onAskChip: (chipId: CoachAskChipId) => void;
}

function CoachCandidateRow({
  candidate,
  isBest,
  onPress,
}: {
  candidate: CoachCandidate;
  isBest: boolean;
  onPress?: () => void;
}) {
  const colors = useThemeColors();
  const content = (
    <View style={{ flexDirection: "row", gap: Spacing.md, alignItems: "center" }}>
      {candidate.thumbnail ? (
        <SmartImage
          source={{ uri: candidate.thumbnail }}
          style={{ width: 52, height: 52, borderRadius: 12 }}
        />
      ) : (
        <RecipeHeroFallback
          id={candidate.recipeId}
          title={candidate.title}
          iconSize={20}
          style={{ width: 52, height: 52, borderRadius: 12 }}
        />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm }}>
          <Text style={{ ...Type.body, color: colors.text, flex: 1 }} numberOfLines={2}>
            {candidate.title}
          </Text>
          {isBest ? (
            <Text
              style={{
                ...Type.caption,
                color: colors.tint,
                backgroundColor: colors.fillQuiet,
                paddingHorizontal: Spacing.sm,
                paddingVertical: 2,
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
        <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 2 }}>
          {candidate.predictedCalories.toLocaleString()} kcal · {candidate.predictedProtein}g protein
        </Text>
        {candidate.whyLine ? (
          <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs }}>
            {candidate.whyLine}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} haptic="selection" style={{ width: "100%" }}>
        <SupprCard style={{ padding: Spacing.md }}>{content}</SupprCard>
      </PressableScale>
    );
  }

  return <SupprCard style={{ padding: Spacing.md }}>{content}</SupprCard>;
}

export function CoachScreenView({
  narrative,
  narrativeLoading,
  candidates,
  candidatesRefining,
  onCandidatePress,
  selectedChipId,
  askAnswer,
  askLoading,
  onAskChip,
}: CoachScreenViewProps) {
  const colors = useThemeColors();

  return (
    <ScrollView
      testID="coach-screen"
      contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xl * 2, gap: Spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      <SupprCard style={{ padding: Spacing.lg, gap: Spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ ...Type.label, color: colors.textSecondary }}>Today&apos;s read</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: colors.fillQuiet,
              paddingHorizontal: Spacing.sm,
              paddingVertical: 2,
              borderRadius: 9999,
            }}
          >
            <Sparkles size={12} color={colors.tint} />
            <Text style={{ ...Type.caption, color: colors.tint, fontWeight: "600" }}>Coach</Text>
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
            Log a meal or save a few recipes — ranked suggestions appear once the coach has something
            to work with.
          </Text>
        ) : (
          candidates.map((c, i) => (
            <CoachCandidateRow
              key={c.recipeId}
              candidate={c}
              isBest={i === 0}
              onPress={onCandidatePress ? () => onCandidatePress(c.recipeId) : undefined}
            />
          ))
        )}
        {candidatesRefining ? (
          <Text style={{ ...Type.caption, color: colors.textSecondary }}>Refining order…</Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: Spacing.sm, alignItems: "flex-start" }}>
          <Info size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <Text style={{ ...Type.caption, color: colors.textSecondary, flex: 1 }}>
            Ranked from your saved recipes against what&apos;s left today. Numbers are always your own.
          </Text>
        </View>
      </View>

      <View style={{ gap: Spacing.sm }}>
        <Text style={{ ...Type.headline, color: colors.text }}>Ask the coach</Text>
        <View style={{ gap: Spacing.sm, alignItems: "flex-start" }}>
          {COACH_ASK_CHIPS.map((chip) => (
            <Pressable
              key={chip.id}
              disabled={askLoading && selectedChipId === chip.id}
              onPress={() => onAskChip(chip.id)}
              style={{
                borderWidth: 1,
                borderColor: selectedChipId === chip.id ? colors.tint : colors.cardBorder,
                backgroundColor:
                  selectedChipId === chip.id ? colors.fillQuiet : colors.card,
                borderRadius: 9999,
                paddingHorizontal: Spacing.lg,
                paddingVertical: Spacing.sm,
              }}
            >
              <Text style={{ ...Type.button, color: colors.text }}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>
        {askLoading ? (
          <Text style={{ ...Type.body, color: colors.textSecondary }}>Coach is thinking…</Text>
        ) : askAnswer ? (
          <SupprCard style={{ padding: Spacing.lg }}>
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
