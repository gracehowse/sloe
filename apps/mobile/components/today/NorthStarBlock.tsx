import { SmartImage } from "@/components/ui/SmartImage";
import { memo } from "react";
import * as React from "react";
import {
  Alert,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { GestureResponderEvent, PanResponderGestureState } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ChevronRight, Sparkles, X } from "lucide-react-native";
import { isFeatureEnabled } from "@/lib/analytics";
import { useHaptics } from "@/hooks/useHaptics";
import {
  resolveOverBudgetCaption,
  type OverBudgetStage,
} from "@suppr/nutrition-core/coachOverBudgetStage";

// 2026-05-12 (premium-bar audit motion polish): use the reanimated
// `createAnimatedComponent` pattern so the resolved component goes
// through React's normal forwardRef pipeline rather than relying on
// `Animated.View` resolving correctly on every renderer (real RN +
// vitest shim). Mirrors `PressableScale.tsx`.
const AnimatedView = Animated.createAnimatedComponent(View);

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

import { NorthStarFigmaHero } from "@/components/today/NorthStarFigmaHero";
import { QuickLogButton } from "@/components/ui/QuickLogButton";
import { SupprButton } from "@/components/ui/SupprButton";
import { SupprCard } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";

/**
 * Mobile `<NorthStarBlock>` — "What to eat next" permanent block on Today.
 *
 * Production design spec — 2026-04-27 Surface A §A-northstar.
 * Authority: D-2026-04-27-04.
 *
 * Renders one of four kinds depending on caller-determined state:
 *   - `default`         — gradient SupprCard with thumb / body / CTA + swipe-to-skip.
 *   - `library-empty`   — primary-tinted invitation when library < 5.
 *   - `over-budget`     — calm caption replaces block when ring is over.
 *   - `no-fit`          — caption + Browse link.
 *
 * Swipe-to-skip (`default` kind, mobile only): pan-left exposes a
 * destructive "Skip" affordance; releasing past 50pt commits a skip
 * and triggers a decisive haptic. Reduce-motion path: a small `X`
 * button at top-right replaces the gesture (matches spec).
 *
 * Web mirror: `src/app/components/suppr/north-star-block.tsx`.
 */

export type NorthStarKind =
  | "default"
  | "library-empty"
  | "over-budget"
  // ENG-1454 — single-day under-eating nudge (<60% of goal by ~8pm local),
  // behind `coaching_stages_v1`. ED-safe: never praises under-eating, never
  // alarms. See `coachOverBudgetStage.ts#underEatingCoachLine`. Flagged for
  // diversity-inclusion + nutrition-engine lens review before ramp.
  | "under-eating"
  | "no-fit"
  // ENG-94 (2026-05-13): on a user's very first day — no nutrition
  // history yet — the `default` suggestion card ("Cajun Steak Bowl
  // — 1,128 kcal · Close fit") felt presumptuous: the algorithm
  // hasn't seen the user eat anything yet, so "close fit" is
  // pattern-matching on targets, not on real intake. Render a calmer
  // "Log your first meal" card instead until ≥ 1 meal has been
  // logged anywhere in the user's history.
  | "new-user";

export interface NorthStarBlockSuggestion {
  recipeId: string;
  title: string;
  thumbnail?: string | null;
  predictedCalories: number;
  predictedProtein: number;
  predictedCarbs: number;
  predictedFat: number;
  bandLabel: string;
  bandTight: boolean;
  /**
   * Activation hook (audit 2026-04-30 — leak fix #5): one-line
   * subtitle explaining WHICH macro the suggestion fits. Without this
   * the user sees "Close fit" but doesn't know what's being fitted —
   * the algorithm reads as a black box. Computed by
   * `whyLineForSuggestion` in `northStarSuggestion.ts` and passed in
   * by the host. Optional so older callers / non-default kinds remain
   * source-compatible.
   */
  whyLine?: string;
  /**
   * Figma `654:2` hero meta row — optional cook time in minutes. When
   * present a "· {n} min" chip with a Clock glyph renders after the
   * kcal span. Sourced from the recipe (`cookTimeMin`) by the host;
   * absent for recipes with no recorded time — the chip degrades away.
   */
  cookTimeMin?: number;
}

export interface NorthStarBlockProps {
  kind: NorthStarKind;
  suggestion?: NorthStarBlockSuggestion;
  /** ENG-1454 — staged over-budget copy for `kind="over-budget"`, behind
   *  `coaching_stages_v1`. No stage/flag-off → legacy caption (kill
   *  switch). See `coachOverBudgetStage.ts`. Mirrors web. */
  overBudgetStage?: OverBudgetStage;
  /** Consumed/goal calories for the staged line's `{n}`. */
  overBudgetCalories?: { consumed: number; goal: number };
  /** ENG-1454 — copy for `kind="under-eating"` (host resolves which of the
   *  two ED-safe states via `isSingleDayUnderEating`/`consecutiveDaysUnderEating`
   *  and passes the finished line). No copy/flag-off → renders nothing (this
   *  kind has no legacy predecessor to fall back to). */
  underEatingLine?: string;
  ctaLabel?: string;
  onPrimaryCta?: () => void;
  /** ENG-1301 (VERIFIED V13) — compact secondary "Log": one-tap logs the
   *  suggested recipe to the suggested slot. The primary CTA keeps routing
   *  to the recipe. Host reuses the existing quick-log insert helper and
   *  owns success feedback; the button owns the loading state. */
  onLogCta?: () => Promise<void> | void;
  onSkip?: () => void;
  onBrowse?: () => void;
  onOpenLibrary?: () => void;
  /** Figma `654:2` slot overline — "Dinner suggestion", etc. */
  slotEyebrow?: string;
  testID?: string;
}

const SKIP_THRESHOLD = 50;

function NorthStarBlockImpl({
  kind,
  suggestion,
  overBudgetStage: stage,
  overBudgetCalories,
  underEatingLine,
  ctaLabel = "Log it",
  onPrimaryCta,
  onLogCta,
  onSkip,
  onBrowse,
  onOpenLibrary,
  slotEyebrow = "Meal suggestion",
  testID,
}: NorthStarBlockProps) {
  const colors = useThemeColors();
  const reduceMotion = useReduceMotion();
  // Secondary accent (Frost flag → damson, else clay) for the Browse link, the
  // "What to eat next" overline, and the suggestion CTA. Read before the early
  // returns so the hook is always called. The band-fit green chip + plum keep
  // their own tokens.
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

  if (kind === "no-fit") {
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

  if (!suggestion) return null;

  if (isFeatureEnabled("today_meals_figma_654")) {
    return (
      <NorthStarFigmaHero
        suggestion={suggestion}
        slotEyebrow={slotEyebrow}
        onPrimaryCta={onPrimaryCta}
        onLogCta={onLogCta}
        onSkip={onSkip}
        reduceMotion={reduceMotion}
        colors={colors}
        testID={testID}
      />
    );
  }

  return (
    <NorthStarDefault
      suggestion={suggestion}
      ctaLabel={ctaLabel}
      onPrimaryCta={onPrimaryCta}
      onLogCta={onLogCta}
      onSkip={onSkip}
      reduceMotion={reduceMotion}
      colors={colors}
      testID={testID}
    />
  );
}

// NorthStarFigmaHero extracted to `NorthStarFigmaHero.tsx` (ENG-1301) so this
// file stays under its screen-budget pin; behaviour unchanged there apart
// from the new compact secondary Log action.

interface NorthStarDefaultProps {
  suggestion: NorthStarBlockSuggestion;
  ctaLabel: string;
  onPrimaryCta?: () => void;
  onLogCta?: () => Promise<void> | void;
  onSkip?: () => void;
  reduceMotion: boolean;
  colors: ReturnType<typeof useThemeColors>;
  testID?: string;
}

function NorthStarDefault({
  suggestion,
  ctaLabel,
  onPrimaryCta,
  onLogCta,
  onSkip,
  reduceMotion,
  colors,
  testID,
}: NorthStarDefaultProps) {
  const haptics = useHaptics();
  // Secondary accent (Frost flag → damson, else clay) for the "What to eat
  // next" overline + the suggestion CTA. The band-fit green chip + plum keep
  // their own tokens.
  const accent = useAccent();
  // Pan responder for swipe-to-skip. We use raw PanResponder rather
  // than reanimated here because the block is a single-state gesture
  // (commit on release > threshold) — the simplicity of PanResponder
  // is appropriate. Reduce-motion users see a top-right `X` button
  // instead of the gesture.
  //
  // Defensive: PanResponder isn't present in the test-time RN shim
  // (see apps/mobile/tests/shims/react-native.cjs) — guard the
  // .create call so unit tests can mount the block without throwing.
  // The gesture path is exercised on-device only; tests target the
  // reduce-motion `X` button fallback.
  const responder = React.useMemo(() => {
    if (
      typeof PanResponder === "undefined" ||
      typeof (PanResponder as { create?: unknown })?.create !== "function"
    ) {
      return { panHandlers: {} } as { panHandlers: Record<string, unknown> };
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => !reduceMotion && gesture.dx < -8 && Math.abs(gesture.dy) < 12,
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        if (gesture.dx <= -SKIP_THRESHOLD && onSkip) {
          haptics.confirm();
          onSkip();
        }
      },
    });
  }, [haptics, onSkip, reduceMotion]);

  // 2026-05-12 (premium-bar audit DC2 polish — Cal AI 200ms fade-up
  // on first paint): the suggestion card eases in over 220ms with a
  // small upward translate so it lands as a deliberate moment, not a
  // pop-in. Reduce-motion users see no animation (skip the tween).
  const fadeOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const fadeTranslate = useSharedValue(reduceMotion ? 0 : 6);
  React.useEffect(() => {
    if (reduceMotion) {
      fadeOpacity.value = 1;
      fadeTranslate.value = 0;
      return;
    }
    fadeOpacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    fadeTranslate.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, fadeOpacity, fadeTranslate]);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
    transform: [{ translateY: fadeTranslate.value }],
  }));

  return (
    <AnimatedView
      {...responder.panHandlers}
      testID={testID ?? "north-star-default"}
      style={fadeStyle}
    >
      {/* Sits on the Today scroll ground → recipe-tier flat (Grace 2026-06-09 one-treatment, superseded by ENG-1099 flat). */}
      <SupprCard lift="flat" tone="primary" padding="md" innerStyle={styles.defaultCard}>
        {reduceMotion && onSkip ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip this suggestion"
            onPress={onSkip}
            hitSlop={6}
            style={styles.skipButton}
          >
            <X size={14} color={colors.textSecondary} strokeWidth={2.25} />
          </Pressable>
        ) : null}

        {/* 2026-05-14 (premium-bar audit DC2 polish — Recime hero
            image): the suggestion card always renders a 64×64
            thumbnail. When the suggestion carries a real
            `thumbnail` URL we render it as an `<Image>`; otherwise
            the deterministic `RecipeHeroFallback` paints the
            cuisine-tinted gradient + glyph so the card never falls
            through to a flat tint placeholder. Border-radius 8 to
            match the bumped 64pt thumb spec. */}
        <View style={styles.thumb}>
          {suggestion.thumbnail ? (
            <SmartImage
              source={{ uri: suggestion.thumbnail }}
              style={{ width: "100%", height: "100%", borderRadius: Radius.lg }}
              resizeMode="cover"
              recyclingKey={suggestion.recipeId ?? suggestion.thumbnail}
            />
          ) : (
            <RecipeHeroFallback
              id={suggestion.recipeId}
              title={suggestion.title}
              iconSize={28}
            />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
            {/* headers census 2026-06-10: sparkle-eyebrow → AA-safe primarySolid. */}
            <Sparkles size={IconSize.xs} color={accent.primarySolid} />
            <Text style={{ ...Type.label, color: accent.primarySolid }}>
              What to eat next
            </Text>
          </View>
          <Text
            style={[Type.headline, { color: colors.text, marginTop: 2 }]}
            numberOfLines={2}
          >
            {suggestion.title}
          </Text>
          {suggestion.whyLine ? (
            // 2026-05-12 (premium-bar audit DC2 polish — "Why this
            // recommendation?" disclosure): the whyLine is now
            // tappable. Tap surfaces an Alert with the longer
            // reasoning (band label + macro fit composition) so
            // power users can audit the engine without leaving the
            // card. MacroFactor parity.
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${suggestion.whyLine}. Tap for full reasoning.`}
              hitSlop={4}
              onPress={() => {
                Alert.alert(
                  "Why this suggestion?",
                  [
                    suggestion.whyLine,
                    `Macro fit: ${suggestion.bandLabel.toLowerCase()}.`,
                    `Predicted: ${suggestion.predictedCalories} kcal · ${Math.round(suggestion.predictedProtein)}g P · ${Math.round(suggestion.predictedCarbs)}g C · ${Math.round(suggestion.predictedFat)}g F.`,
                    "Sloe picks the saved recipe that best closes the gap to your remaining macros for today. Re-run by skipping (swipe left) to see another candidate.",
                  ].filter(Boolean).join("\n\n"),
                );
              }}
              style={{ alignSelf: "flex-start", paddingVertical: 2 }}
            >
              <Text
                style={[
                  Type.caption,
                  {
                    color: colors.textSecondary,
                    marginTop: 2,
                    textDecorationLine: "underline",
                    textDecorationStyle: "dotted",
                  },
                ]}
                numberOfLines={1}
              >
                {suggestion.whyLine}
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <View
              style={[
                styles.chip,
                {
                  backgroundColor: suggestion.bandTight
                    ? Accent.success + "1A"
                    : colors.cardBorder,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: suggestion.bandTight
                    ? Accent.successSolid
                    : colors.textSecondary,
                }}
              >
                {suggestion.bandLabel}
              </Text>
            </View>
            {/* 2026-05-12 (premium-bar audit cross-cutting): macro
                format unified to `698 kcal · 22g P · 95g C · 27g F`
                across Today + Eat Again + Plan grid. Was slash-
                separated (`22P / 95C / 27F`). */}
            <Text
              style={[
                Type.caption,
                {
                  color: colors.textSecondary,
                  fontVariant: ["tabular-nums"],
                },
              ]}
            >
              {suggestion.predictedCalories} kcal · {Math.round(suggestion.predictedProtein)}g P · {Math.round(suggestion.predictedCarbs)}g C · {Math.round(suggestion.predictedFat)}g F
            </Text>
          </View>

          {/* Button system (2026-06-12,
              `docs/decisions/2026-06-12-button-system-solid-primary.md`):
              the "what to eat next" CTA is this card's ONE primary action →
              `SupprButton` variant="primary" (solid aubergine fill, white
              label, pill, no shadow — the solid fill IS the affordance).
              Supersedes the old aubergine-OUTLINE treatment which read
              weak/floating on the flat cream ground. The FAB stays the
              screen-level loudest pixel (FAB-excepted from one-per-screen).
              Mirror of web `north-star-block.tsx`. */}
          <View style={styles.ctaRow}>
            <SupprButton
              variant="primary"
              accessibilityLabel={ctaLabel}
              label={ctaLabel}
              onPress={onPrimaryCta}
              style={styles.cta}
            />
            {/* ENG-1301 — compact secondary Log (ghost, per the 2026-06-12
                button system): one-tap logs the suggested recipe to the
                suggested slot; the primary keeps routing to the recipe. */}
            {onLogCta ? (
              <QuickLogButton
                testID="north-star-log-cta"
                onLog={onLogCta}
                accessibilityLabel={`Log ${suggestion.title}`}
              />
            ) : null}
          </View>
        </View>
      </SupprCard>
    </AnimatedView>
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
  defaultCard: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: Spacing.md,
  },
  // 2026-05-12 (premium-bar audit, DC2 polish): bumped 56→64 to match
  // the Recime hero-image size for the "what to eat next" card. The
  // image is the trust signal that converts the suggestion into "yes
  // I want that" — 56 was reading as a small avatar, 64 reads as a
  // proper thumbnail. Same ratio as macro tile internal padding so
  // the whole card breathes correctly.
  // 2026-05-14 — borderRadius 12 → 8 + overflow hidden so the
  // optional `RecipeHeroFallback` (absolute-positioned svg) clips to
  // the thumbnail's rounded edge. 8 matches the audit spec.
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    overflow: "hidden",
    flexShrink: 0,
    position: "relative",
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  ctaRow: {
    // ENG-1301 — primary CTA + compact ghost Log share one row.
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  cta: {
    // Layout only — the `SupprButton` primitive owns fill/radius/label
    // colour/padding (button system, 2026-06-12). The CTA hugs its label
    // at the start of the card body rather than stretching full-width.
    alignSelf: "flex-start",
  },
  skipButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});

export const NorthStarBlock = memo(NorthStarBlockImpl);

export default NorthStarBlock;
