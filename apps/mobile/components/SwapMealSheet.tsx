/**
 * Swap meal bottom sheet (ENG-1011, 2026-06-10 — fresh-eyes P0 class B).
 *
 * Replaces the native `Alert.alert` recipe picker (up to 11 stacked system
 * pills, no photos, no macro context, no haptics — prototype-tier mid-flow).
 * Same chassis as `MoveMealSheet` (the sibling row-action from the same meal
 * action sheet) so the two actions read as one design language; content
 * grammar borrows the best-in-class swap pattern (photo + name + kcal per
 * candidate with target context — Mobbin: BitePal swap picker).
 *
 * Does no I/O — the caller hands in fit-ranked candidates and an onPick
 * callback; portion-refit + over-target confirm stay in the planner.
 */
import { useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Star, UtensilsCrossed } from "lucide-react-native";
import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export type SwapCandidate = {
  id: string;
  title: string;
  calories: number;
  proteinG: number;
  image: string | null;
  /** True when the recipe is in the user's library (★ tag, sorted first by caller). */
  isSaved: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Slot being swapped, e.g. "Lunch". */
  slotName: string;
  /** Day label for the header context, e.g. "Wed". */
  dayLabel: string;
  /** Slot kcal target the candidates were ranked against. */
  targetKcal: number;
  /** Fit-ranked candidates (best first), capped by the caller. */
  candidates: SwapCandidate[];
  onPick: (recipeId: string) => void;
};

function CandidateThumb({
  image,
  title,
  fallbackBg,
  fallbackFg,
}: {
  image: string | null;
  title: string;
  fallbackBg: string;
  fallbackFg: string;
}) {
  // Broken-image fallback mirrors `PlanMealThumb` (planner.tsx) — same
  // element family, same treatment. Placeholder = tonal chip + utensil
  // glyph until the painterly imagery system lands (ENG-1015).
  const [broken, setBroken] = useState(false);
  const trimmed = (image ?? "").trim();
  if (trimmed.length > 0 && !broken) {
    return (
      <Image
        source={{ uri: trimmed }}
        accessibilityLabel={`${title} thumbnail`}
        style={[styles.thumb, { backgroundColor: fallbackBg }]}
        resizeMode="cover"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <View
      aria-hidden
      style={[styles.thumb, { backgroundColor: fallbackBg, alignItems: "center", justifyContent: "center" }]}
    >
      <UtensilsCrossed size={16} color={fallbackFg} strokeWidth={2} />
    </View>
  );
}

export function SwapMealSheet({
  visible,
  onClose,
  slotName,
  dayLabel,
  targetKcal,
  candidates,
  onPick,
}: Props) {
  const colors = useThemeColors();
  const accent = useAccent();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close swap meal"
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Swap meal</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {slotName} · {dayLabel} · target ~{Math.round(targetKcal).toLocaleString()} kcal
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Cancel" hitSlop={8}>
            <Text style={{ color: accent.primarySolid, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView
          style={{ maxHeight: 480 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl }}
        >
          {candidates.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              No alternatives for this slot yet — save more recipes from Discover.
            </Text>
          ) : (
            candidates.map((c) => {
              const delta = Math.round(c.calories - targetKcal);
              const deltaLabel =
                Math.abs(delta) < 25 ? "on target" : delta > 0 ? `+${delta}` : `${delta}`;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    if (process.env.EXPO_OS === "ios") {
                      // Medium impact — committing a plan change, one tier
                      // above selection (same weight as MoveMealSheet picks).
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    onPick(c.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Swap to ${c.title}, ${c.calories} kcal${c.isSaved ? ", from your library" : ""}`}
                  style={[
                    styles.row,
                    { backgroundColor: colors.background, borderColor: colors.cardBorder },
                  ]}
                >
                  <CandidateThumb
                    image={c.image}
                    title={c.title}
                    fallbackBg={accent.primarySoft}
                    fallbackFg={accent.primarySolid}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
                      <Text
                        style={{ color: colors.text, fontWeight: "700", fontSize: 13, flexShrink: 1 }}
                        numberOfLines={1}
                      >
                        {c.title}
                      </Text>
                      {c.isSaved ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                            backgroundColor: accent.primarySoft,
                            borderRadius: Radius.full,
                            paddingHorizontal: Spacing.sm,
                            paddingVertical: 2, // tag canon pV (census 2026-06-10)
                          }}
                        >
                          <Star size={9} color={accent.primarySolid} strokeWidth={2.5} />
                          <Text style={{ color: accent.primarySolid, fontSize: 10, fontWeight: "700" }}>
                            Library
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {c.calories.toLocaleString()} kcal · {Math.round(c.proteinG)}g protein
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: 11,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {deltaLabel}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Chassis matches MoveMealSheet (same element family, same treatment).
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
  },
});

export default SwapMealSheet;
