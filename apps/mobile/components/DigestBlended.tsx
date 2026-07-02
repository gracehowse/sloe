/**
 * `<DigestBlended>` — the merged premium Week-Digest card (mobile).
 *
 * ENG-740. Blends the old dismissable `<Digest>` recap and the
 * always-on `<DigestStoryCard>` into ONE card with a single soft-filled
 * region (the closest-day hero) and everything else hairline +
 * whitespace separated. Built to
 * `docs/prototypes/2026-05-26-progress-digest-blend/index.html` + the 8
 * principles in `docs/ux/premium-design-language.md`.
 *
 * Gated by `progress_digest_blend`; the host swaps `<Digest blended>`
 * for the legacy stacked layout. Mirror:
 * `src/app/components/suppr/digest-blended.tsx`.
 *
 * Platform deviations vs web (enumerated, not accidental):
 *   - Share uses RN `Share.share` (web uses navigator.share + clipboard).
 *   - Light haptic on share tap; selection haptic on dismiss.
 *   - Metric strip can 2×2-wrap on narrow widths but stays BORDERLESS.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import { Share2, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled, track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  classifyDigestHeroTone,
  digestHeroTrackFraction,
} from "@suppr/nutrition-core/digest";
import {
  decideWeightSurface,
  DIGEST_HIDDEN_WEIGHT_REPLACEMENT_HINT,
  DIGEST_HIDDEN_WEIGHT_REPLACEMENT_LABEL,
  formatLoggingConsistencyValue,
} from "@suppr/nutrition-core/weightSurfaceMode";
import type { DigestProps } from "@/components/Digest";

export function DigestBlended(props: DigestProps) {
  const {
    weekKey,
    weekLabel,
    daysLogged,
    headline,
    stats,
    narrative,
    shareText,
    state = "success",
    offlineSyncedLabel,
    onRetry,
    onShare,
    onDismiss,
    onAdjustPace,
    weightSurfaceMode = "show",
    blendedExtras,
  } = props;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the "Adjust pace"
  // link. Positive/win beats keep `Accent.success`; misses keep destructive.
  const accent = useAccent();
  const cardElevation = useCardElevation();

  const shownRef = useRef<string | null>(null);
  useEffect(() => {
    if (state === "loading" || state === "error") return;
    if (shownRef.current === weekKey) return;
    shownRef.current = weekKey;
    track(AnalyticsEvents.weekly_recap_shown, { weekKey });
  }, [weekKey, state]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track(AnalyticsEvents.weekly_recap_shared, { weekKey, platform: Platform.OS });
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

  // Error state — minimal tile (parity with legacy).
  if (state === "error") {
    return (
      <View
        testID="digest"
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
        testID="digest"
        accessibilityLabel="Loading week digest"
        style={{
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: Spacing.lg,
          marginBottom: 14,
          minHeight: 200,
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

  // ── HERO.
  const closest = narrative.closestToTarget;
  const closestTarget = blendedExtras?.closestDayTargetCalories ?? null;
  const hasTrack = !!closest && !!closestTarget && closestTarget > 0;
  const heroTone = hasTrack
    ? classifyDigestHeroTone(closest!.calories, closestTarget!)
    : "neutral";
  const heroFraction = hasTrack
    ? digestHeroTrackFraction(closest!.calories, closestTarget!)
    : 0;
  const heroColor =
    heroTone === "under"
      ? Accent.success
      : heroTone === "over"
        ? Accent.destructive
        : colors.text;

  // progress_digest_beige_v2 (Option A): pull mobile's hero off the opaque slab to
  // web's muted/40 tint (over the white card → #fbfaf7). Alpha keeps it dark-mode-safe.
  const heroFill = isFeatureEnabled("progress_digest_beige_v2")
    ? colors.backgroundSecondary + "66"
    : colors.backgroundSecondary;

  // ── Metric strip.
  const hasWeight = stats.weightDeltaKg != null;
  const weightDecision = decideWeightSurface(weightSurfaceMode, stats.weightDeltaKg);
  const weightDeltaStr = hasWeight
    ? `${stats.weightDeltaKg! > 0 ? "+" : ""}${stats.weightDeltaKg}`
    : "—";
  const weightFirstLast =
    weightDecision.kind === "show" &&
    stats.weightFirstKg != null &&
    stats.weightLastKg != null
      ? `${stats.weightFirstKg}→${stats.weightLastKg}`
      : null;
  const proteinOnTarget =
    stats.proteinAdherencePct != null && stats.proteinAdherencePct > 0;

  // ── PATTERN.
  const pattern = blendedExtras?.dayOfWeekPattern ?? null;
  const showPattern = !isEmpty && daysLogged >= 4 && pattern != null;
  const patternMax = pattern ? Math.max(pattern.highDayAvg, pattern.lowDayAvg, 1) : 1;

  const hairline = (
    <View style={{ height: 1, backgroundColor: colors.cardBorder, marginHorizontal: -2 }} />
  );

  return (
    <View
      testID="digest"
      style={{
        backgroundColor: cardElevation.liftBg ?? colors.card,
        borderRadius: Radius.lg,
        borderWidth: cardElevation.useBorder ? 1 : 0,
        borderColor: colors.cardBorder,
        padding: Spacing.lg,
        marginBottom: 14,
        ...(cardElevation.shadowStyle ?? {}),
      }}
    >
      {/* Eyebrow + dismiss */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        {/* headers census 2026-06-10: eyebrow → Type.label (kills the 10.5px half-pixel). */}
        <Text style={{ ...Type.label, color: colors.textSecondary }}>
          WEEK DIGEST · {weekLabel.toUpperCase()}
        </Text>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss week digest"
          hitSlop={12}
        >
          <X size={17} color={colors.textTertiary} />
        </Pressable>
      </View>

      {/* HERO — the one soft-filled region */}
      <View
        testID="digest-hero"
        style={{
          backgroundColor: heroFill,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 14,
          marginBottom: 16,
        }}
      >
        {isEmpty ? (
          <>
            {/* headers census 2026-06-10: eyebrow → Type.label. */}
            <Text style={{ ...Type.label, color: colors.textSecondary, marginBottom: 3 }}>
              THIS WEEK
            </Text>
            <Text testID="digest-hero-empty" style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
              {headline}
            </Text>
            <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: 4 }}>
              No days logged yet — log a meal to start your week.
            </Text>
          </>
        ) : closest ? (
          <>
            {/* headers census 2026-06-10: eyebrow → Type.label. */}
            <Text style={{ ...Type.label, color: colors.textSecondary, marginBottom: 3 }}>
              CLOSEST TO TARGET
            </Text>
            {/* headers census 2026-06-10: digest hero day-title → serif Type.title
                (was a 24/800 sans-bold pre-Sloe header). */}
            <Text
              testID="digest-hero-day"
              accessibilityRole="header"
              style={{ ...Type.title, color: colors.text, marginBottom: 14 }}
            >
              {closest.label}
            </Text>
            {hasTrack ? (
              <>
                <View
                  testID="digest-hero-track"
                  style={{ height: 3, borderRadius: 2, backgroundColor: colors.cardBorder, marginHorizontal: 2, marginBottom: 7 }}
                >
                  <View
                    testID="digest-hero-dot"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: `${Number((heroFraction * 100).toFixed(1))}%`,
                      width: 11,
                      height: 11,
                      borderRadius: 6,
                      backgroundColor: heroColor,
                      borderWidth: 2,
                      borderColor: colors.card,
                      transform: [{ translateX: -5.5 }, { translateY: -5.5 }],
                    }}
                  />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  {/* SLOE Phase 0: the closest-day hero kcal reads in Newsreader
                      serif (family carries the weight; the `kcal` unit stays sans). */}
                  <Text testID="digest-hero-calories" style={{ fontFamily: FontFamily.serifRegular, fontSize: 28, color: heroColor, fontVariant: ["tabular-nums"] }}>
                    {Math.round(closest.calories).toLocaleString()}
                    <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 13, fontWeight: "600", color: heroColor }}> kcal</Text>
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary, fontVariant: ["tabular-nums"] }}>
                    {Math.round(closestTarget!).toLocaleString()} target
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
                  <Text style={{ fontSize: 10, color: colors.textTertiary }}>your day</Text>
                  <Text style={{ fontSize: 10, color: colors.textTertiary }}>target</Text>
                </View>
              </>
            ) : (
              <Text testID="digest-hero-calories" style={{ fontFamily: FontFamily.serifRegular, fontSize: 28, color: colors.text, fontVariant: ["tabular-nums"] }}>
                {Math.round(closest.calories).toLocaleString()}
                <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 13, fontWeight: "600", color: colors.text }}> kcal</Text>
              </Text>
            )}
            <Text testID="digest-hero-protein" style={{ ...Type.captionSmall, color: colors.textSecondary, marginTop: 10 }}>
              {closest.protein}g protein · your most on-target day this week
            </Text>
          </>
        ) : (
          <>
            {/* headers census 2026-06-10: eyebrow → Type.label. */}
            <Text style={{ ...Type.label, color: colors.textSecondary, marginBottom: 3 }}>
              THIS WEEK
            </Text>
            {/* headers census 2026-06-10: parallel digest hero title (empty/closest
                paths share one role) → serif Type.title, was 20/800 sans-bold. */}
            <Text testID="digest-hero-day" accessibilityRole="header" style={{ ...Type.title, color: colors.text }}>
              {headline}
            </Text>
          </>
        )}
      </View>

      {/* Hairline → borderless metric strip */}
      {hairline}
      <View testID="digest-stat-strip" style={{ flexDirection: "row", flexWrap: "wrap", paddingVertical: 16 }}>
        <Metric label="Streak" value={isEmpty ? "—" : `${stats.streakDays}`} unit={isEmpty ? undefined : "d"} />
        <Metric
          label="Avg cal"
          value={isEmpty ? "—" : stats.avgCalories.toLocaleString()}
          sub={isEmpty ? undefined : `per day${partialOverN}`}
        />
        <Metric
          label="Protein"
          value={isEmpty ? "—" : `${stats.avgProtein}g`}
          sub={isEmpty ? undefined : proteinOnTarget ? `${stats.proteinAdherencePct}% of target` : "no target set"}
          subTone={proteinOnTarget ? "success" : "muted"}
        />
        {weightDecision.kind === "hidden" ? (
          <Metric
            label={DIGEST_HIDDEN_WEIGHT_REPLACEMENT_LABEL}
            value={isEmpty ? "—" : formatLoggingConsistencyValue(daysLogged)}
            sub={isEmpty ? undefined : DIGEST_HIDDEN_WEIGHT_REPLACEMENT_HINT}
          />
        ) : weightDecision.kind === "trends" ? (
          <Metric
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
            sub={weightDecision.label}
          />
        ) : (
          <Metric
            label="Weight"
            value={hasWeight ? weightDeltaStr : "—"}
            unit={hasWeight ? "kg" : undefined}
            sub={weightFirstLast ?? (hasWeight ? undefined : "log weight any day")}
          />
        )}
      </View>

      {/* Hairline → PATTERN row */}
      {showPattern && pattern ? (
        <>
          {hairline}
          <View testID="digest-pattern" style={{ paddingVertical: 16 }}>
            {/* headers census 2026-06-10: eyebrow → Type.label. */}
            <Text style={{ ...Type.label, color: colors.textSecondary, marginBottom: 6 }}>
              PATTERN
            </Text>
            <Text testID="digest-pattern-summary" style={{ fontSize: 13.5, fontWeight: "600", color: colors.text, marginBottom: 10 }}>
              {pluralWeekday(pattern.highDay)} ran higher than {pluralWeekday(pattern.lowDay)} this week
            </Text>
            <PatternBar
              label={shortDay(pattern.highDay)}
              widthPct={(pattern.highDayAvg / patternMax) * 100}
              value={`~${pattern.highDayAvg.toLocaleString()}`}
            />
            <PatternBar
              label={shortDay(pattern.lowDay)}
              widthPct={(pattern.lowDayAvg / patternMax) * 100}
              value={`~${pattern.lowDayAvg.toLocaleString()}`}
            />
            <Text testID="digest-pattern-delta" style={{ fontSize: 11, color: colors.textSecondary, textAlign: "right", marginTop: 2, fontVariant: ["tabular-nums"] }}>
              +{pattern.deltaKcal.toLocaleString()} kcal
            </Text>
          </View>
        </>
      ) : null}

      {/* Hairline → maintenance row */}
      {!isEmpty && narrative.maintenanceLine ? (
        <>
          {hairline}
          <View testID="digest-maintenance-line" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 15, paddingBottom: 4 }}>
            <Text style={{ flex: 1, fontSize: 11.5, color: colors.textSecondary, lineHeight: 17 }}>
              {narrative.maintenanceLine}
            </Text>
            {onAdjustPace ? (
              <Pressable onPress={onAdjustPace} testID="digest-adjust-pace" hitSlop={8}>
                <Text style={{ fontSize: 11.5, fontWeight: "600", color: accent.primarySolid }}>Adjust pace →</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {/* Footer */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 14 }}>
        <Pressable
          onPress={handleShare}
          disabled={shareDisabled}
          accessibilityRole="button"
          accessibilityLabel="Share week digest"
          accessibilityState={{ disabled: shareDisabled }}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 7,
            paddingHorizontal: 16,
            paddingVertical: 11,
            borderRadius: 12,
            backgroundColor: shareDisabled ? colors.cardBorder + "22" : Accent.success + "1f",
            opacity: shareDisabled ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          <Share2 size={14} color={shareDisabled ? colors.textSecondary : Accent.success} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: shareDisabled ? colors.textSecondary : Accent.success }}>
            Share week
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss week digest and continue"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textSecondary }}>Got it</Text>
        </Pressable>
      </View>

      {isOffline && offlineSyncedLabel ? (
        <Text testID="digest-offline-note" style={{ fontSize: 11, color: colors.textSecondary, marginTop: 8 }}>
          Showing last synced · {offlineSyncedLabel}.
        </Text>
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  unit,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  subTone?: "muted" | "success";
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flexBasis: "25%", flexGrow: 1, minWidth: 76, paddingRight: 14 }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3, fontVariant: ["tabular-nums"] }}>
        {value}
        {unit ? <Text style={{ fontSize: 11, fontWeight: "500", color: colors.textSecondary }}> {unit}</Text> : null}
      </Text>
      {/* headers census 2026-06-10: stat label eyebrow → Type.label. The stat
          VALUE above (17/800 sans numeral) stays sans — numerals don't go serif
          (Type.heroValue/macroValue convention); the map mis-read it as a header. */}
      <Text style={{ ...Type.label, color: colors.textSecondary, marginTop: 4 }}>
        {label.toUpperCase()}
      </Text>
      {sub ? (
        <Text style={{ fontSize: 10.5, color: subTone === "success" ? Accent.success : colors.textTertiary, marginTop: 1 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function PatternBar({
  label,
  widthPct,
  value,
}: {
  label: string;
  widthPct: number;
  value: string;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the pattern-bar fill.
  const accent = useAccent();
  const clamped = Math.min(100, Math.max(0, widthPct));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 5 }}>
      <Text style={{ fontSize: 11, color: colors.textSecondary, width: 30 }}>{label}</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.cardBorder, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${Number(clamped.toFixed(1))}%`, borderRadius: 4, backgroundColor: accent.primary + "3D" }} />
      </View>
      <Text style={{ fontSize: 11, color: colors.textTertiary, width: 46, textAlign: "right", fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}

/** "Sunday" → "Sundays" (proper-noun weekday plural). */
function pluralWeekday(label: string): string {
  if (!label) return label;
  if (label.endsWith("s")) return label;
  return `${label}s`;
}

/** "Sunday" → "Sun" for the pattern bar row labels. */
function shortDay(label: string): string {
  return label.slice(0, 3);
}

export default DigestBlended;
