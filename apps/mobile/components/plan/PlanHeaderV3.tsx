import { StyleSheet, Text, View } from "react-native";
import { Bookmark, Sparkles, SlidersHorizontal } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";

import { IconButton } from "@/components/ui/IconButton";
import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Elevation, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import type { PlanWeekVerdict } from "@suppr/shared/planning/planWeekStatus";

/**
 * PlanHeaderV3 — the Sloe v3 Plan header + week-verdict row.
 *
 * Parity twin of the prototype (`docs/ux/redesign/v3/Sloe-App.html` Plan
 * screen ~L4707–4721): the date-range overline + "Your plan" serif title with
 * quiet round action buttons (generate / adjust / templates), then a verdict
 * row — a tone dot + "On track — N of M days on target" headline + "{M−N} days need
 * a meal or swap" nudge. The verdict comes from {@link PlanWeekVerdict}
 * (`computePlanWeekVerdict`), so completeness logic stays shared web↔mobile.
 *
 * Design-consistency pass (2026-07-24), behind `design_consistency_v1`:
 *   - the overline uses the canonical `Type.eyebrow` ink caps;
 *   - the hand-rolled action chassis becomes the shared `IconButton` 40px
 *     muted chip (ENG-1662 anatomy owner), so Plan stops being the one
 *     surface with white rounded-square card buttons;
 *   - `showGenerate` retires the Sparkles chip while the empty-week card is
 *     up — that card's own "Generate this week" owns the action, and two
 *     controls firing one handler is redundancy, not affordance.
 *
 * Presentational only — the host computes the date label + verdict and owns the
 * generate/adjust/templates handlers. Behind the `sloe_v3_plan` flag.
 */
export interface PlanHeaderV3Props {
  /** Week range, e.g. "16–22 June". Rendered uppercase as the overline. */
  dateRangeLabel: string;
  /** Completeness verdict, or `null` before a plan exists (verdict row hidden). */
  verdict: PlanWeekVerdict | null;
  onGenerate: () => void;
  onAdjust: () => void;
  onTemplates: () => void;
  /** Show the Sparkles generate chip. Hosts pass `false` while the empty-week
   *  card is showing — it already carries "Generate this week" as its one
   *  filled CTA. Defaults to `true` (a populated week has no other generate
   *  affordance). */
  showGenerate?: boolean;
}

/** Legacy (kill-switch) button chassis — the white rounded-square card fork
 *  and its `primary_screen_chrome_v1` circular variant. Retired visually by
 *  `design_consistency_v1`, kept alive so the flag can roll back. */
function ActButton({
  label,
  onPress,
  bg,
  consistencyChrome,
  children,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  consistencyChrome: boolean;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.act,
        consistencyChrome ? styles.actStandard : styles.actLegacy,
        {
          backgroundColor: consistencyChrome ? colors.backgroundSecondary : bg,
          borderColor: colors.border,
        },
      ]}
    >
      {children}
    </PressableScale>
  );
}

function HeaderAction({
  label,
  icon: Icon,
  glyph,
  onPress,
  unifiedChrome,
  consistencyChrome,
}: {
  label: string;
  icon: LucideIcon;
  /** Legacy glyph size — the unified path uses the shared 16px chip glyph. */
  glyph: number;
  onPress: () => void;
  unifiedChrome: boolean;
  consistencyChrome: boolean;
}) {
  const colors = useThemeColors();
  if (unifiedChrome) {
    return (
      <IconButton
        icon={Icon}
        size="lg"
        variant="muted"
        accessibilityLabel={label}
        onPress={onPress}
        iconSize={IconSize.base}
        iconStrokeWidth={1.9}
      />
    );
  }
  return (
    <ActButton
      label={label}
      onPress={onPress}
      bg={colors.card}
      consistencyChrome={consistencyChrome}
    >
      <Icon size={glyph} color={colors.text} strokeWidth={1.9} />
    </ActButton>
  );
}

export function PlanHeaderV3({
  dateRangeLabel,
  verdict,
  onGenerate,
  onAdjust,
  onTemplates,
  showGenerate = true,
}: PlanHeaderV3Props) {
  const colors = useThemeColors();
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.titleCol}>
          {unifiedChrome ? (
            // Design-consistency pass 2026-07-24 — the canonical eyebrow shared
            // with ScreenSectionChrome / TodayGreetingHero. No rule here: the
            // action chips sit on this optical line and the rule would run
            // straight into them.
            <Text style={[styles.overlineUnified, { color: colors.text }]}>
              {dateRangeLabel.toUpperCase()}
            </Text>
          ) : (
            <Text style={[styles.overline, { color: colors.textTertiary }]}>
              {dateRangeLabel.toUpperCase()}
            </Text>
          )}
          <Text
            style={[
              consistencyChrome ? styles.pageTitle : styles.title,
              { color: colors.text },
            ]}
          >
            Your plan
          </Text>
        </View>
        <View style={styles.acts}>
          {showGenerate ? (
            <HeaderAction
              label="Generate week"
              icon={Sparkles}
              glyph={17}
              onPress={onGenerate}
              unifiedChrome={unifiedChrome}
              consistencyChrome={consistencyChrome}
            />
          ) : null}
          <HeaderAction
            label="Adjust constraints"
            icon={SlidersHorizontal}
            glyph={17}
            onPress={onAdjust}
            unifiedChrome={unifiedChrome}
            consistencyChrome={consistencyChrome}
          />
          <HeaderAction
            label="Templates"
            icon={Bookmark}
            glyph={IconSize.base}
            onPress={onTemplates}
            unifiedChrome={unifiedChrome}
            consistencyChrome={consistencyChrome}
          />
        </View>
      </View>

      {verdict ? (
        <View style={styles.verdict}>
          <View
            style={[
              styles.dot,
              {
                // ENG-1547 — success = green, genuine problem = amber,
                // in-progress ("On track") = a calm neutral dot, never amber.
                backgroundColor:
                  verdict.tone === "success"
                    ? Accent.success
                    : verdict.tone === "warning"
                      ? Accent.warning
                      : colors.textTertiary,
              },
            ]}
          />
          <Text style={[styles.vHeadline, { color: colors.text }]}>{verdict.headline}</Text>
          {verdict.subline ? (
            <Text style={[styles.vSub, { color: colors.textTertiary }]}>{verdict.subline}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  titleCol: { flexShrink: 1, minWidth: 0 },
  overline: { ...Type.statLabel },
  overlineUnified: { ...Type.eyebrow },
  title: { ...Type.screenTitle, marginTop: 3 },
  pageTitle: { ...Type.pageTitle, marginTop: Spacing.xs },
  acts: { flexDirection: "row", alignItems: "center", gap: 4 },
  act: {
    alignItems: "center",
    justifyContent: "center",
  },
  actStandard: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
  },
  actLegacy: {
    // v3 `.planx-act`: rounded-square WHITE CARD button (radius 11) with a 1px
    // border + soft lift — not a circle, not flat. Grace's call (2026-06-27)
    // to override the flat-surface default for these buttons so they match the
    // prototype's white-card + shadow-card treatment. (Card bg passed in `bg`.)
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    // Subtle crisp lift (not the floaty page-card cardSoft) — matches the
    // prototype `--shadow-card` + web `shadow-sm` on these 38px buttons.
    ...Elevation.cardHairline,
  },
  verdict: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: Spacing.dense,
  },
  dot: { width: 8, height: 8, borderRadius: Radius.full },
  // Sentence case — the prototype renders "On track — N of M days on target" as a
  // sentence, not an overline (Type.label defaults to uppercase). ENG-1247.
  vHeadline: { ...Type.label, fontSize: 14, lineHeight: 18, textTransform: "none", letterSpacing: 0 },
  vSub: { ...Type.caption },
});

export default PlanHeaderV3;
