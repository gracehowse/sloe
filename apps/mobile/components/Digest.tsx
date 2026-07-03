/**
 * Digest primitive (D3) — mobile.
 *
 * Replaces `WeeklyRecapCard.tsx`. Mirrors the web `Digest` component
 * (`src/app/components/suppr/digest.tsx`) with an identical prop surface
 * so web and mobile cannot drift. See `docs/design/digest-primitive.md`.
 *
 * Platform differences (§9 of brief):
 *   - Share uses RN `Share.share` (web uses navigator.share + clipboard).
 *   - Light haptic on share tap; selection haptic on dismiss.
 *   - Tiles always 2×2 on mobile (web can flow 4-up ≥720px).
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Bookmark, Share as ShareIcon, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { formatKcalDisplay } from "@suppr/nutrition-core/formatMacro";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import type { SavedMealItem } from "@suppr/nutrition-core/savedMeals";
import type { DigestBlendedExtras } from "@suppr/nutrition-core/digest";
import {
  decideWeightSurface,
  DIGEST_HIDDEN_WEIGHT_REPLACEMENT_HINT,
  DIGEST_HIDDEN_WEIGHT_REPLACEMENT_LABEL,
  formatLoggingConsistencyValue,
  type WeightSurfaceMode,
} from "@suppr/nutrition-core/weightSurfaceMode";
import { DigestBlended } from "@/components/DigestBlended";
import { SupprButton } from "@/components/ui/SupprButton";

export type DigestSlot = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

export type DigestUsualMeal =
  | { kind: "celebration"; name: string; count: number }
  | {
      kind: "prompt";
      suggestedSlot: DigestSlot;
      repeats?: number;
      seedItems?: Omit<SavedMealItem, "id" | "position">[];
    };

export interface DigestProps {
  weekKey: string;
  weekLabel: string;
  daysLogged: number;
  mealsLogged: number;
  headline: string;
  stats: {
    streakDays: number;
    streakFreezesAvailable: number;
    avgCalories: number;
    avgProtein: number;
    proteinAdherencePct: number | null;
    weightDeltaKg: number | null;
    weightFirstKg: number | null;
    weightLastKg: number | null;
  };
  narrative: {
    closestToTarget: {
      label: string;
      protein: number;
      calories: number;
    } | null;
    maintenanceLine: string | null;
    usualMeal: DigestUsualMeal | null;
  };
  shareText: string;
  state?: "loading" | "empty" | "partial" | "success" | "error" | "offline";
  offlineSyncedLabel?: string;
  onRetry?: () => void;
  onShare: () => void;
  onDismiss: () => void;
  onOpenSaveCombo?: (
    slot: DigestSlot,
    seedItems: Omit<SavedMealItem, "id" | "position">[],
  ) => void;
  onStartUsualMealSave?: (slot: DigestSlot) => void;
  /** T13 (2026-04-24): weight surface mode. Mirrors web Digest prop;
   *  defaults to "show" for backward compat. See
   *  `src/lib/nutrition/weightSurfaceMode.ts`. */
  weightSurfaceMode?: WeightSurfaceMode;
  /**
   * ENG-740 — when `true`, render the blended premium Week-Digest
   * (one soft-filled hero + hairline-separated strip / PATTERN /
   * maintenance row), merging `<Digest>` + `<DigestStoryCard>`. Gated
   * by `progress_digest_blend` at the host. Default `false` keeps the
   * legacy layout. Mirrors the web `Digest` prop surface.
   */
  blended?: boolean;
  /** ENG-740 — extra data the blended layout consumes (hero track +
   *  PATTERN bars). Only read when `blended` is `true`. */
  blendedExtras?: DigestBlendedExtras;
  /** ENG-740 — blended maintenance row's optional "Adjust pace →" link.
   *  When omitted the link is suppressed. Routes to the mobile targets
   *  editor. */
  onAdjustPace?: () => void;
}

/**
 * `Digest` — thin dispatcher. When `props.blended` is set (the
 * `progress_digest_blend` flag is on at the host) we render the merged
 * premium card; otherwise the legacy stacked layout. Keeping the
 * branch at the component boundary (not an early-return inside one
 * body) keeps both render paths' hooks unconditional.
 */
export function Digest(props: DigestProps) {
  if (props.blended) {
    return <DigestBlended {...props} />;
  }
  return <DigestLegacy {...props} />;
}

function DigestLegacy(props: DigestProps) {
  const {
    weekKey,
    weekLabel,
    daysLogged,
    mealsLogged,
    headline,
    stats,
    narrative,
    shareText,
    state = "success",
    offlineSyncedLabel,
    onRetry,
    onShare,
    onDismiss,
    onOpenSaveCombo,
    onStartUsualMealSave,
    weightSurfaceMode = "show",
  } = props;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the digest CTA tint +
  // fill. Positive/win beats keep `Accent.success`.
  const accent = useAccent();
  // Card-shell unification (2026-06-10): page-ground card → soft lift.
  const cardElevation = useCardElevation({ variant: "soft" });

  // `weekly_digest_shown` — fire once per visible weekKey. Legacy name
  // `weekly_recap_shown` carries over (§ open-question #11).
  const shownRef = useRef<string | null>(null);
  useEffect(() => {
    if (state === "loading" || state === "error") return;
    if (shownRef.current === weekKey) return;
    shownRef.current = weekKey;
    track(AnalyticsEvents.weekly_recap_shown, { weekKey });
  }, [weekKey, state]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track(AnalyticsEvents.weekly_recap_shared, {
      weekKey,
      platform: Platform.OS,
    });
    onShare();
    try {
      await Share.share({ message: shareText });
    } catch {
      /* user cancelled */
    }
  }, [weekKey, shareText, onShare]);

  const handleDismiss = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    track(AnalyticsEvents.weekly_recap_dismissed, { weekKey });
    onDismiss();
  }, [weekKey, onDismiss]);

  const usual = narrative.usualMeal;
  const promptSlot = usual?.kind === "prompt" ? usual.suggestedSlot : null;

  const handlePromptTap = useCallback(() => {
    if (!promptSlot || usual?.kind !== "prompt") return;
    const seed = usual.seedItems ?? [];
    if (seed.length >= 2 && onOpenSaveCombo) {
      try {
        track(AnalyticsEvents.weekly_recap_save_prompt_tapped, {
          slot: promptSlot,
          seedCount: seed.length,
        });
      } catch {
        /* fire-and-forget */
      }
      onOpenSaveCombo(promptSlot, seed);
      return;
    }
    if (onStartUsualMealSave) {
      try {
        track(AnalyticsEvents.weekly_recap_save_prompt_tapped, {
          slot: promptSlot,
          seedCount: seed.length,
        });
      } catch {
        /* fire-and-forget */
      }
      onStartUsualMealSave(promptSlot);
    }
  }, [promptSlot, usual, onOpenSaveCombo, onStartUsualMealSave]);

  const hasWeight = stats.weightDeltaKg != null;
  // T13: honour the user's weight surface mode. "hide" swaps the Weight
  // tile for logging-consistency + suppresses the weigh-in line.
  // "trends_only" shows a direction icon + friendly label (no kg).
  const weightDecision = decideWeightSurface(weightSurfaceMode, stats.weightDeltaKg);
  const weightDeltaStr = hasWeight
    ? `${stats.weightDeltaKg! > 0 ? "+" : ""}${stats.weightDeltaKg} kg`
    : "—";
  const weightFirstLastLine = useMemo(() => {
    if (weightDecision.kind !== "show") return null;
    if (
      stats.weightFirstKg != null &&
      stats.weightLastKg != null &&
      stats.weightDeltaKg != null
    ) {
      return `First → Last weigh-in: ${stats.weightFirstKg} → ${stats.weightLastKg} kg (${
        stats.weightDeltaKg > 0 ? "+" : ""
      }${stats.weightDeltaKg} kg)`;
    }
    return null;
  }, [stats.weightFirstKg, stats.weightLastKg, stats.weightDeltaKg, weightDecision.kind]);

  // Error state — minimal tile.
  if (state === "error") {
    return (
      <View
        testID="digest-error"
        style={{
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: Spacing.lg,
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          Couldn&rsquo;t load your digest.{" "}
          {onRetry ? (
            <Text
              onPress={onRetry}
              style={{ color: colors.text, fontWeight: "700", textDecorationLine: "underline" }}
            >
              Try again
            </Text>
          ) : (
            <Text>Try again.</Text>
          )}
        </Text>
      </View>
    );
  }

  // Loading skeleton.
  if (state === "loading") {
    return (
      <View
        testID="digest-skeleton"
        accessibilityLabel="Loading week digest"
        style={{
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: Spacing.lg,
          marginBottom: 14,
          minHeight: 180,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.textSecondary} />
      </View>
    );
  }

  const isEmpty = state === "empty" || daysLogged === 0;
  const isOffline = state === "offline";
  const shareDisabled = isEmpty || isOffline;

  const partialOverN = state === "partial" ? ` (over ${daysLogged} days)` : "";
  const proteinHint =
    stats.proteinAdherencePct != null && stats.proteinAdherencePct > 0
      ? `${stats.proteinAdherencePct}% of target${partialOverN}`
      : "no target set";

  return (
    <View
      testID="digest"
      style={{
        backgroundColor: cardElevation.liftBg ?? colors.card,
        borderRadius: CARD_RADIUS,
        borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
        borderColor: colors.cardBorder,
        padding: Spacing.lg,
        marginBottom: 14,
        ...(cardElevation.shadowStyle ?? {}),
      }}
    >
      {/* Dismiss */}
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss week digest"
        hitSlop={12}
        style={{ position: "absolute", right: 12, top: 12, padding: 4, width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
      >
        <X size={18} color={colors.textSecondary} />
      </Pressable>

      {/* Eyebrow */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        {/* headers census 2026-06-10: hand-rolled eyebrow → Type.label. */}
        <Text style={{ ...Type.label, color: colors.textSecondary }}>
          WEEK DIGEST
        </Text>
        <Text style={{ fontSize: 10, color: colors.textSecondary, opacity: 0.7 }}>· {weekLabel}</Text>
      </View>

      <Text
        accessibilityRole="header"
        style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 2 }}
      >
        {headline}
      </Text>
      <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: 14 }}>
        {isEmpty
          ? "No days logged — that's fine."
          : `${daysLogged} day${daysLogged === 1 ? "" : "s"} logged · ${mealsLogged} item${mealsLogged === 1 ? "" : "s"}.`}
      </Text>

      {/* Stat grid — always 2×2 on mobile */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }} testID="digest-stat-strip">
        <Stat
          label="Streak"
          value={isEmpty ? "—" : `${stats.streakDays}`}
          hint={
            isEmpty
              ? "log any day to start"
              : stats.streakFreezesAvailable > 0
                ? `day${stats.streakDays === 1 ? "" : "s"} · ${stats.streakFreezesAvailable} freeze${stats.streakFreezesAvailable === 1 ? "" : "s"}`
                : `day${stats.streakDays === 1 ? "" : "s"}`
          }
          muted={isEmpty}
        />
        <Stat
          label="Avg calories"
          value={isEmpty ? "—" : `${stats.avgCalories}`}
          hint={isEmpty ? "—" : `per day${partialOverN}`}
          muted={isEmpty}
        />
        <Stat
          label="Avg protein"
          value={isEmpty ? "—" : `${stats.avgProtein}g`}
          hint={isEmpty ? "—" : proteinHint}
          muted={isEmpty}
        />
        {weightDecision.kind === "hidden" ? (
          <Stat
            label={DIGEST_HIDDEN_WEIGHT_REPLACEMENT_LABEL}
            value={isEmpty ? "—" : formatLoggingConsistencyValue(daysLogged)}
            hint={isEmpty ? "log any day to start" : DIGEST_HIDDEN_WEIGHT_REPLACEMENT_HINT}
            muted={isEmpty}
          />
        ) : weightDecision.kind === "trends" ? (
          <Stat
            label="Weight"
            value={
              weightDecision.direction === "up"
                ? "↑"
                : weightDecision.direction === "down"
                  ? "↓"
                  : weightDecision.direction === "stable"
                    ? "→"
                    : "—"
            }
            hint={weightDecision.label}
            muted={weightDecision.direction === null}
          />
        ) : (
          <Stat
            label="Weight"
            value={hasWeight ? weightDeltaStr : "—"}
            hint={hasWeight ? "first → last weigh-in" : "log weight any day"}
            muted={!hasWeight}
          />
        )}
      </View>

      {/* Narrative lines */}
      {!isEmpty && narrative.closestToTarget ? (
        <Text
          testID="digest-closest-to-target"
          style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: 10 }}
        >
          Closest to target —{" "}
          <Text style={{ fontWeight: "700", color: colors.text }}>{narrative.closestToTarget.label}</Text>
          {" · "}
          {narrative.closestToTarget.protein}g protein, {formatKcalDisplay(narrative.closestToTarget.calories)} kcal
        </Text>
      ) : null}

      {!isEmpty && weightFirstLastLine ? (
        <Text
          testID="digest-weight-first-last"
          style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: 10 }}
        >
          {weightFirstLastLine}
        </Text>
      ) : null}

      {!isEmpty && narrative.maintenanceLine ? (
        <Text
          testID="digest-maintenance-line"
          style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: 10 }}
        >
          {narrative.maintenanceLine}
        </Text>
      ) : null}

      {!isEmpty && usual?.kind === "celebration" ? (
        <Text
          testID="digest-usual-celebration"
          style={{ ...Type.captionSmall, color: colors.text, marginBottom: 10 }}
        >
          You logged <Text style={{ fontWeight: "700" }}>{usual.name}</Text>{" "}
          {usual.count} time{usual.count === 1 ? "" : "s"} this week.
        </Text>
      ) : null}

      {!isEmpty && usual?.kind === "prompt" && promptSlot ? (
        <View
          testID="digest-usual-prompt"
          style={{
            padding: 12,
            marginBottom: 10,
            borderRadius: Radius.md,
            backgroundColor: accent.primary + "0D",
            borderWidth: 1,
            borderColor: accent.primary + "40",
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
            Got a usual {promptSlot.toLowerCase()}?
          </Text>
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
            {usual.repeats && usual.repeats >= 3
              ? `You've logged the same one ${usual.repeats} times in 2 weeks.`
              : "Save it once, log it in one tap."}
          </Text>
          {/* Sloe button-system canon (2026-06-12): the nudge's ONE commit
              action — save this prompt as a meal — is the SOLID aubergine
              primary. White bookmark glyph + white label inside the pill. */}
          {onStartUsualMealSave || onOpenSaveCombo ? (
            <SupprButton
              variant="primary"
              onPress={handlePromptTap}
              accessibilityLabel={`Save ${promptSlot} as a usual meal`}
              style={{ alignSelf: "flex-start", marginTop: 8 }}
            >
              <Bookmark size={12} color="#fff" strokeWidth={2.25} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff", marginLeft: 4 }}>
                Save {promptSlot} as a meal
              </Text>
            </SupprButton>
          ) : null}
        </View>
      ) : null}

      {/* Footer */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={handleShare}
          disabled={shareDisabled}
          accessibilityRole="button"
          accessibilityLabel="Share week digest"
          accessibilityState={{ disabled: shareDisabled }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: shareDisabled ? colors.cardBorder + "22" : Accent.success + "18",
            borderWidth: 1,
            borderColor: shareDisabled ? colors.cardBorder : Accent.success + "30",
            opacity: shareDisabled ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          <ShareIcon
            size={14}
            color={shareDisabled ? colors.textSecondary : Accent.success}
          />
          <Text
            style={{
              fontFamily: Type.captionSmall.fontFamily,
              fontSize: Type.captionSmall.fontSize,
              lineHeight: Type.captionSmall.lineHeight,
              fontWeight: "700",
              color: shareDisabled ? colors.textSecondary : Accent.success,
            }}
          >
            Share week
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss week digest and continue"
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 8,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ ...Type.captionSmall, color: colors.textSecondary }}>Got it</Text>
        </Pressable>
      </View>

      {isOffline && offlineSyncedLabel ? (
        <Text
          testID="digest-offline-note"
          style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}
        >
          Showing last synced · {offlineSyncedLabel}.
        </Text>
      ) : null}
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
        // headers census 2026-06-10: hand-rolled eyebrow → Type.label (token
        // already uppercases; the .toUpperCase() below is now redundant but
        // harmless).
        style={{ ...Type.label, color: colors.textSecondary, marginBottom: 2 }}
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
