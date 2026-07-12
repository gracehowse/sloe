import { SmartImage } from "@/components/ui/SmartImage";
import { memo } from "react";
import * as React from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Sparkles, X } from "lucide-react-native";
import { isFeatureEnabled } from "@/lib/analytics";
import { useSwipeToSkipResponder } from "@/hooks/useSwipeToSkipResponder";
import type { OverBudgetStage } from "@suppr/nutrition-core/coachOverBudgetStage";
import { formatQualifiedKcal } from "@suppr/nutrition-core/formatMacro";

// 2026-05-12 (premium-bar audit motion polish): use the reanimated
// `createAnimatedComponent` pattern so the resolved component goes
// through React's normal forwardRef pipeline rather than relying on
// `Animated.View` resolving correctly on every renderer (real RN +
// vitest shim). Mirrors `PressableScale.tsx`.
const AnimatedView = Animated.createAnimatedComponent(View);

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

import { NorthStarFigmaHero } from "@/components/today/NorthStarFigmaHero";
import { NorthStarBlockNonDefault } from "@/components/today/NorthStarBlockNonDefault";
import { QuickLogButton } from "@/components/ui/QuickLogButton";
import { SupprButton } from "@/components/ui/SupprButton";
import { SupprCard } from "@/components/ui/SupprCard";
import { RecipeHeroFallback } from "@/components/RecipeHeroFallback";
import { recipeUnderlayColor } from "@suppr/shared/recipe/recipeHeroFallback";

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
 * The five non-`default` branches (`library-empty`, `over-budget`,
 * `under-eating`, `no-fit`, `new-user`) live in `NorthStarBlockNonDefault.tsx`
 * so this file stays under its screen-line-budget pin (mirrors the web
 * `north-star-block-non-default.tsx` extraction).
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
  /** ENG-1417 — verified vs estimate; absent → "~" qualifier (safe default). */
  isVerified?: boolean;
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

  if (kind !== "default") {
    return (
      <NorthStarBlockNonDefault
        kind={kind}
        testID={testID}
        overBudgetStage={stage}
        overBudgetCalories={overBudgetCalories}
        underEatingLine={underEatingLine}
        onOpenLibrary={onOpenLibrary}
        onBrowse={onBrowse}
      />
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
  // Secondary accent (Frost flag → damson, else clay) for the "What to eat
  // next" overline + the suggestion CTA. Band-fit chip + plum keep own tokens.
  const accent = useAccent();
  const scheme = useResolvedScheme(); // ENG-1528 — dark ramp underlay on dark cards
  // Swipe-left-to-skip gesture — extracted to `useSwipeToSkipResponder`
  // (screen-budget pin). Reduce-motion users see the `X` button instead.
  const responder = useSwipeToSkipResponder(reduceMotion, onSkip);

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
  // ENG-1417 — flag-gated "~" unverified-estimate qualifier (kill switch off).
  const kcalDisplay = isFeatureEnabled("kcal_trust_qualifier_v1")
    ? formatQualifiedKcal(suggestion.predictedCalories, suggestion.isVerified)
    : String(suggestion.predictedCalories);

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
            `thumbnail` URL we render it as an `<Image>`; otherwise the
            deterministic `RecipeHeroFallback` paints the cuisine-tinted
            gradient + glyph (ENG-1374 PR 2: the wrapper grounds on the
            same tint — never page white). Border-radius 8. */}
        <View style={[styles.thumb, { backgroundColor: recipeUnderlayColor({ id: suggestion.recipeId, title: suggestion.title }, scheme) }]}>
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
                    `Predicted: ${kcalDisplay} kcal · ${Math.round(suggestion.predictedProtein)}g P · ${Math.round(suggestion.predictedCarbs)}g C · ${Math.round(suggestion.predictedFat)}g F.`,
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
              {kcalDisplay} kcal · {Math.round(suggestion.predictedProtein)}g P · {Math.round(suggestion.predictedCarbs)}g C · {Math.round(suggestion.predictedFat)}g F
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
