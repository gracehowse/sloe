import React, { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Check, ChevronRight, Circle, Flame, Shield, Snowflake } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { GradientAvatar } from "@/components/GradientAvatar";
import { PressableScale } from "@/components/ui/PressableScale";
import { SupprButton } from "@/components/ui/SupprButton";
import { RecipeCardImage } from "@/components/library/RecipeCardImage";
import { isFeatureEnabled } from "@/lib/analytics";
import { type EditorialProfileBlockModel, type StreakDotState } from "@/lib/editorialProfileBlock";
import { weekdayInitials } from "@suppr/shared/today/weekdayLabels";
import {
  PROFILE_UPGRADE_BANNER_TDEE_GLOSS,
  PROFILE_UPGRADE_BANNER_TDEE_PLAIN,
} from "@suppr/shared/onboarding/figmaCopy";

/** Recipe subset the grid needs — matches the mobile RecipeCard fields used. */
export interface EditorialProfileRecipe {
  id: string;
  title: string;
  image: string | null;
}

export interface EditorialProfileBlockProps {
  displayName: string;
  joinedLabel: string | null;
  monogramInitial: string;
  tierLabel: string;
  isPro: boolean;
  /** Derived streak/dots/milestones model (from buildEditorialProfileBlock). */
  model: EditorialProfileBlockModel;
  /** Saved recipes for the preview grid (already-loaded rows — no fetch here). */
  recipes: EditorialProfileRecipe[];
  /** Total saved-recipe count (may exceed the previewed grid). */
  recipeCount: number;
  /** Open a recipe from the grid (router.push in the host). */
  onOpenRecipe: (recipeId: string) => void;
  /** "See all" → the Recipes tab. */
  onSeeAllRecipes: () => void;
  /** Empty-state escape hatch → Discover. Without it the "Browse Discover to
   *  start your collection" copy is a dead end (design-consistency pass). */
  onBrowseDiscover?: () => void;
  /** ENG-1641 — single primary Upgrade CTA for non-Pro (footer). */
  onUpgrade?: () => void;
}

/** Max recipes rendered in the preview grid — one tidy 3-up row. */
const RECIPE_GRID_LIMIT = 6;

/** Sunday-first initials are indexed 0=Sunday — exactly `Date.getDay()`'s own
 *  ordering — so the pip labels and the Today day strip read one source. */
const WEEKDAY_INITIALS = weekdayInitials("sunday");

/** Weekday initial for a `YYYY-MM-DD` key (local date, no UTC shift). */
function weekdayInitialFor(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";
  return WEEKDAY_INITIALS[new Date(y, (m ?? 1) - 1, d ?? 1).getDay()] ?? "";
}

/** "3- and 7-day reached" / "3-, 7- and 30-day reached" / "3-day reached".
 *  Web twin: `src/app/components/profile/EditorialProfileBlock.tsx`. */
function formatReachedSummary(days: readonly number[]): string | null {
  if (days.length === 0) return null;
  if (days.length === 1) return `${days[0]}-day reached`;
  const head = days.slice(0, -1).map((d) => `${d}-`);
  return `${head.join(", ")} and ${days[days.length - 1]}-day reached`;
}

const DOT_STATE_WORDS: Record<StreakDotState, string> = {
  logged: "logged", frozen: "freeze used", missed: "not logged",
};

/**
 * EditorialProfileBlock — the shared editorial Profile block (Gap #16,
 * ENG-1246): identity → streak pips + best/freezes line → milestones → recipe
 * grid. Display-only; every value is derived upstream from already-loaded data
 * (freeze ledger, saved recipes). No fetches, no writes. Mobile twin of the web
 * `EditorialProfileBlock` — same IA, native primitives (PressableScale +
 * haptics).
 */
function EditorialProfileBlockImpl({
  displayName, joinedLabel, monogramInitial, tierLabel, isPro, model, recipes,
  recipeCount, onOpenRecipe, onSeeAllRecipes, onBrowseDiscover, onUpgrade,
}: EditorialProfileBlockProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const styles = useMemo(() => makeStyles(colors, accent), [colors, accent]);
  // ENG-1593 — Rule 7 (DESIGN-CONSTITUTION.md): serif initial + frost-ring +
  // the ONE canonical damson fill, default-OFF (see apps/mobile/lib/analytics.ts
  // flag note).
  const avatarFrostRingV1 = isFeatureEnabled("avatar_monogram_frost_ring_v1");
  const glossOn = isFeatureEnabled("onboarding_jargon_gloss_v1");
  // Design-consistency pass (default-ON; every branch keeps its old path in the
  // `else` as the kill switch). Five fixes: ONE identity-avatar treatment (the
  // Today header's damson chip), tier stated once in an accent badge, a labelled
  // binary streak-pip row, actionable-first milestones, and a Discover CTA on
  // the empty saved-recipes state.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");

  const gridRecipes = recipes.slice(0, RECIPE_GRID_LIMIT);
  const freezeCount = model.freezesAvailable;

  const dotColor = (s: StreakDotState): string =>
    s === "logged" ? accent.successSolid : s === "frozen" ? colors.textTertiary : colors.cardBorder;

  // Tier is stated ONCE: the Pro badge owns it for Pro, the subline owns it for
  // everyone else (a "Free" badge would read as a penalty marker).
  const tierAndJoined = `${tierLabel}${joinedLabel ? ` · ${joinedLabel}` : ""}`;
  const identityMeta = unifiedChrome && isPro ? joinedLabel : tierAndJoined;

  // Milestones lead with the only actionable row; reached landmarks collapse
  // into one quiet summary line instead of greyed rows above the target.
  const reachedSummary = unifiedChrome
    ? formatReachedSummary(model.milestones.filter((m) => m.achieved).map((m) => m.days))
    : null;
  const pending = model.milestones.filter((m) => !m.achieved);
  const orderedMilestones = unifiedChrome
    ? [...pending.filter((m) => m.next), ...pending.filter((m) => !m.next)]
    : model.milestones;

  // The pip row answers exactly ONE question — "did I log that day?" — over a
  // named 7-day window, so it can never be mistaken for the streak count.
  const pipAriaLabel = `Last ${model.dots.length} days: ${model.dots
    .map((d) => `${weekdayInitialFor(d.dateKey)} ${DOT_STATE_WORDS[d.state]}`)
    .join(", ")}`;

  return (
    <View style={styles.wrap}>
      {/* Identity — monogram + name + joined subline + Pro badge. ONE identity
          disc: the damson `Accent.purple` the Today header chip already fills
          with; the hand-rolled `accent.primarySolid` monogram (a DIFFERENT plum)
          survives only as the flag-off kill switch. Damson is also THE
          Pro/achievement slot — a paid badge must not be the card's quietest chip. */}
      <View style={styles.identityCard}>
        {avatarFrostRingV1 ? (
          <GradientAvatar size={48} initial={monogramInitial} fontSize={Type.title.fontSize} gradientIdSuffix="editorial-profile-monogram" fill={Accent.purple} textColor={colors.primaryForeground} treatment="frostRing" />
        ) : unifiedChrome ? (
          <GradientAvatar size={48} initial={monogramInitial} fontSize={Type.title.fontSize} gradientIdSuffix="editorial-profile-monogram" fill={Accent.purple} textColor={colors.primaryForeground} />
        ) : (
          <View style={styles.monogram} accessible={false}>
            <Text style={styles.monogramInitial}>{monogramInitial}</Text>
          </View>
        )}
        <View style={styles.identityBody}>
          <Text style={styles.identityName} numberOfLines={1}>{displayName.trim() || "Your profile"}</Text>
          {identityMeta ? (
            <Text style={styles.identityMeta} numberOfLines={1}>{identityMeta}</Text>
          ) : null}
        </View>
        {isPro ? (
          <View style={[styles.tierPill, unifiedChrome ? styles.tierPillAccent : null]}>
            <Text style={[styles.tierPillText, unifiedChrome ? styles.tierPillTextAccent : null]}>{tierLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Streak — labelled pip row + best/freezes line. The old row mixed three
          dot colours with a grey halo on today (an idiom used nowhere else) under
          a "Best streak 12 days" line seven pips can't express. Now: a NAMED
          window, weekday letters, logged-vs-not dots, and the day strip's own
          idioms — ink density marks today, freeze days keep the snowflake. */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.inlineRow}>
            <Flame size={16} color={accent.primarySolid} strokeWidth={2.25} />
            <Text style={styles.streakLabel}>{model.currentStreak}-day streak</Text>
          </View>
          {freezeCount > 0 ? (
            <View style={styles.inlineRow}>
              <Shield size={13} color={colors.textSecondary} strokeWidth={2.25} />
              <Text style={styles.freezeLabel}>{freezeCount} freeze{freezeCount === 1 ? "" : "s"}</Text>
            </View>
          ) : null}
        </View>
        {unifiedChrome ? (
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>Last 7 days</Text>
            <View style={styles.eyebrowRule} />
          </View>
        ) : null}
        {/* `accessible` groups the 7 weekday `<Text>` letters into ONE VoiceOver
            stop (web's `role="img"` groups implicitly) — as `PlanGhostWeekGrid`. */}
        <View accessible style={[styles.dotRow, unifiedChrome ? styles.pipRow : null]} accessibilityRole="image" accessibilityLabel={pipAriaLabel}>
          {model.dots.map((dot) =>
            unifiedChrome ? (
              <View key={dot.dateKey} style={styles.pipCol}>
                <Text style={[styles.pipLetter, dot.isToday ? styles.pipLetterToday : null]}>
                  {weekdayInitialFor(dot.dateKey)}
                </Text>
                <View style={styles.pipGlyphBox}>
                  {dot.state === "frozen" ? (
                    <Snowflake size={IconSize.sm} color={Accent.cyan} strokeWidth={2} />
                  ) : (
                    <View style={[styles.dot, { backgroundColor: dot.state === "logged" ? accent.successSolid : colors.border }]} />
                  )}
                </View>
              </View>
            ) : (
              <View key={dot.dateKey} style={[styles.dot, { backgroundColor: dotColor(dot.state) }, dot.isToday ? styles.dotToday : null]} />
            ),
          )}
        </View>
        <Text style={styles.bestLine}>
          Best streak {model.bestStreak} day{model.bestStreak === 1 ? "" : "s"}
          {freezeCount > 0 ? ` · ${freezeCount} freeze${freezeCount === 1 ? "" : "s"} in hand` : ""}
        </Text>
      </View>

      {/* Milestones — the actionable "Next up" target leads; reached landmarks
          collapse into the one quiet summary line below the list. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Milestones</Text>
        {unifiedChrome && orderedMilestones.length === 0 ? (
          <Text style={styles.milestoneAllDone}>Every milestone reached</Text>
        ) : null}
        {orderedMilestones.map((m) => {
          const isNextUp = unifiedChrome && m.next;
          return (
            <View key={m.days} style={styles.milestoneRow}>
              <View style={[styles.milestoneIcon, m.achieved ? styles.milestoneIconDone : isNextUp ? styles.milestoneIconNext : styles.milestoneIconTodo]}>
                {m.achieved ? (
                  <Check size={14} color={accent.successSolid} strokeWidth={2.5} />
                ) : (
                  <Circle size={12} color={isNextUp ? accent.primarySolid : colors.textTertiary} strokeWidth={1.75} />
                )}
              </View>
              <Text style={[styles.milestoneLabel, m.achieved || isNextUp ? styles.milestoneLabelDone : null]}>
                {m.days}-day streak
              </Text>
              {m.next ? (
                <Text style={styles.milestoneNext}>Next up</Text>
              ) : m.achieved ? (
                <Text style={styles.milestoneReached}>Reached</Text>
              ) : null}
            </View>
          );
        })}
        {reachedSummary ? (
          <Text style={styles.milestoneReached} testID="editorial-profile-reached">{reachedSummary}</Text>
        ) : null}
      </View>

      {/* Recipe grid — saved recipes preview (already-loaded rows). */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Saved recipes</Text>
          {recipeCount > 0 ? (
            <PressableScale haptic="selection" onPress={onSeeAllRecipes} accessibilityRole="button" accessibilityLabel={`See all ${recipeCount} saved recipes`} style={styles.seeAll}>
              <Text style={styles.seeAllText}>See all {recipeCount}</Text>
              <ChevronRight size={14} color={accent.primarySolid} strokeWidth={2.25} />
            </PressableScale>
          ) : null}
        </View>
        {gridRecipes.length === 0 ? (
          // The copy tells the user to browse Discover — so the card ships the
          // way there. Ghost, because the screen's one filled CTA is Upgrade.
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              Recipes you save land here. Browse Discover to start your collection.
            </Text>
            {unifiedChrome && onBrowseDiscover ? (
              <SupprButton variant="ghost" size="sm" label="Browse Discover" onPress={onBrowseDiscover} haptic="selection" accessibilityLabel="Browse Discover to find recipes to save" testID="editorial-profile-browse-discover" style={styles.emptyCta} />
            ) : null}
          </View>
        ) : (
          <View style={styles.grid}>
            {gridRecipes.map((recipe) => (
              <PressableScale key={recipe.id} haptic="selection" onPress={() => onOpenRecipe(recipe.id)} accessibilityRole="button" accessibilityLabel={`Open ${recipe.title}`} style={styles.tile}>
                <RecipeCardImage uri={recipe.image} cardImageStyle={styles.tileImage} recipeId={recipe.id} recipeTitle={recipe.title} />
              </PressableScale>
            ))}
          </View>
        )}
      </View>

      {/* ENG-1641 — one primary Upgrade CTA in the editorial footer for non-Pro. */}
      {!isPro && onUpgrade ? (
        <View style={styles.upgradeWrap}>
          <SupprButton variant="primary" label="Upgrade to Pro" onPress={onUpgrade} accessibilityLabel="Upgrade to Pro" testID="editorial-profile-upgrade" />
          <Text style={styles.upgradeHint}>
            {glossOn ? PROFILE_UPGRADE_BANNER_TDEE_GLOSS : PROFILE_UPGRADE_BANNER_TDEE_PLAIN}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useThemeColors>,
  accent: ReturnType<typeof useAccent>,
) {
  return StyleSheet.create({
    wrap: { gap: Spacing.md },

    identityCard: {
      flexDirection: "row", alignItems: "center", gap: Spacing.md,
      backgroundColor: colors.card, borderRadius: Radius.lg,
      borderWidth: 1, borderColor: colors.border, padding: Spacing.md,
    },
    monogram: {
      width: 48, height: 48, borderRadius: Radius.full,
      backgroundColor: accent.primarySolid, alignItems: "center", justifyContent: "center",
    },
    monogramInitial: { ...Type.title, color: accent.primaryForeground },
    identityBody: { flex: 1, minWidth: 0 },
    identityName: { ...Type.title, color: colors.text },
    identityMeta: { ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs },
    tierPill: {
      paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
      borderRadius: Radius.full, backgroundColor: accent.primarySoft,
    },
    tierPillText: { ...Type.label, color: accent.primarySolid },
    // Damson = THE Pro/achievement slot (theme.ts `Accent.purple`); white label
    // on it clears AA and matches the identity disc beside it.
    tierPillAccent: { paddingHorizontal: Spacing.dense, backgroundColor: Accent.purple },
    tierPillTextAccent: { color: Accent.primaryForeground },

    card: {
      backgroundColor: colors.card, borderRadius: Radius.lg, borderWidth: 1,
      borderColor: colors.border, padding: Spacing.md, gap: Spacing.dense,
    },
    cardTitle: { ...Type.headline, color: colors.text },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    inlineRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    streakLabel: {
      ...Type.body, color: colors.text, fontWeight: "600", fontVariant: ["tabular-nums"],
    },
    freezeLabel: {
      ...Type.caption, color: colors.textSecondary, fontWeight: "600", fontVariant: ["tabular-nums"],
    },

    // THE canonical page-chrome eyebrow (Type.eyebrow + a `border` hairline rule
    // to the margin) — names the pip window so it can't read as a second streak
    // counter. Web twin: `text-[11px] … tracking-[0.12em]` + `h-px bg-border`.
    eyebrowRow: { flexDirection: "row", alignItems: "center", gap: Spacing.dense },
    eyebrow: { ...Type.eyebrow, color: colors.text },
    eyebrowRule: { flex: 1, height: 1, backgroundColor: colors.border },

    dotRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
    pipRow: { alignItems: "flex-start", gap: 0 },
    pipCol: { flex: 1, minWidth: 0, alignItems: "center", gap: Spacing.sm },
    // Day-strip letter voice: 11/400/0.1em caps, tertiary — TODAY steps to full
    // ink (the strip's ink-density idiom), never a halo ring.
    pipLetter: {
      fontFamily: Type.body.fontFamily, fontSize: 11, lineHeight: 14, fontWeight: "400",
      letterSpacing: 1.1, textTransform: "uppercase", color: colors.textTertiary,
    },
    pipLetterToday: { color: colors.text },
    pipGlyphBox: { height: IconSize.sm, alignItems: "center", justifyContent: "center" },
    dot: { width: 10, height: 10, borderRadius: Radius.full },
    // m7 — semi-transparent today ring (~40% opacity, `+ '66'`) matching the web
    // `ring-primary/40` halo. ENG-1572 exempt: deliberate cross-platform parity.
    // Flag-off only — the unified pip row marks today with ink density instead.
    dotToday: { borderWidth: 2, borderColor: accent.primarySolid + "66" },
    bestLine: { ...Type.caption, color: colors.textSecondary, fontVariant: ["tabular-nums"] },

    milestoneRow: { flexDirection: "row", alignItems: "center", gap: Spacing.dense },
    milestoneIcon: {
      width: 24, height: 24, borderRadius: Radius.full,
      alignItems: "center", justifyContent: "center",
    },
    // n14 — dark-aware success tint (~15%, `+ '26'`) via the threaded `accent`,
    // so the done-icon fill tracks the scheme instead of the static light sage.
    milestoneIconDone: { backgroundColor: `${accent.success}26` },
    milestoneIconTodo: { backgroundColor: colors.cardBorder },
    milestoneIconNext: { backgroundColor: accent.primarySoft },
    milestoneLabel: { ...Type.body, flex: 1, color: colors.textSecondary },
    milestoneLabelDone: { color: colors.text, fontWeight: "600" },
    milestoneNext: { ...Type.caption, color: accent.primarySolid, fontWeight: "700" },
    milestoneReached: { ...Type.caption, color: colors.textSecondary },
    milestoneAllDone: { ...Type.body, color: colors.text, fontWeight: "600" },

    seeAll: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
    seeAllText: {
      ...Type.caption, color: accent.primarySolid, fontWeight: "700", fontVariant: ["tabular-nums"],
    },
    emptyWrap: { gap: Spacing.sm, alignItems: "flex-start" },
    emptyText: { ...Type.bodyMuted, color: colors.textSecondary },
    emptyCta: { alignSelf: "flex-start" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    tile: {
      width: "31.5%", aspectRatio: 1, borderRadius: Radius.lg,
      overflow: "hidden", backgroundColor: colors.cardBorder,
    },
    tileImage: { width: "100%", height: "100%" },
    upgradeWrap: { gap: Spacing.sm },
    upgradeHint: { ...Type.caption, color: colors.textSecondary, textAlign: "center" },
  });
}

export const EditorialProfileBlock = memo(EditorialProfileBlockImpl);

export default EditorialProfileBlock;
