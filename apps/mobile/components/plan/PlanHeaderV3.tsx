import { StyleSheet, Text, View } from "react-native";
import { Bookmark, Sparkles, SlidersHorizontal } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Elevation, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { PlanWeekVerdict } from "@suppr/shared/planning/planWeekStatus";

/**
 * PlanHeaderV3 — the Sloe v3 Plan header + week-verdict row.
 *
 * Parity twin of the prototype (`docs/ux/redesign/v3/Sloe-App.html` Plan
 * screen ~L4707–4721): the date-range overline + "Your plan" serif title with
 * three quiet action buttons (generate / adjust / templates), then a verdict
 * row — a tone dot + "On track — N of M days land" headline + "{M−N} days need
 * a meal or swap" nudge. The verdict comes from {@link PlanWeekVerdict}
 * (`computePlanWeekVerdict`), so completeness logic stays shared web↔mobile.
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
}

function ActButton({
  label,
  onPress,
  bg,
  children,
}: {
  label: string;
  onPress: () => void;
  bg: string;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.act, { backgroundColor: bg, borderColor: colors.border }]}
    >
      {children}
    </PressableScale>
  );
}

export function PlanHeaderV3({
  dateRangeLabel,
  verdict,
  onGenerate,
  onAdjust,
  onTemplates,
}: PlanHeaderV3Props) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.titleCol}>
          <Text style={[styles.overline, { color: colors.textTertiary }]}>
            {dateRangeLabel.toUpperCase()}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>Your plan</Text>
        </View>
        <View style={styles.acts}>
          <ActButton label="Generate week" onPress={onGenerate} bg={colors.card}>
            <Sparkles size={17} color={colors.text} strokeWidth={1.9} />
          </ActButton>
          <ActButton label="Adjust constraints" onPress={onAdjust} bg={colors.card}>
            <SlidersHorizontal size={17} color={colors.text} strokeWidth={1.9} />
          </ActButton>
          <ActButton label="Templates" onPress={onTemplates} bg={colors.card}>
            <Bookmark size={16} color={colors.text} strokeWidth={1.9} />
          </ActButton>
        </View>
      </View>

      {verdict ? (
        <View style={styles.verdict}>
          <View
            style={[
              styles.dot,
              { backgroundColor: verdict.tone === "success" ? Accent.success : Accent.warning },
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
  title: { ...Type.screenTitle, marginTop: 3 },
  acts: { flexDirection: "row", alignItems: "center", gap: 4 },
  act: {
    // v3 `.planx-act`: rounded-square WHITE CARD button (radius 11) with a 1px
    // border + soft lift — not a circle, not flat. Grace's call (2026-06-27)
    // to override the flat-surface default for these buttons so they match the
    // prototype's white-card + shadow-card treatment. (Card bg passed in `bg`.)
    width: 38,
    height: 38,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
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
  // Sentence case — the prototype renders "On track — N of M days land" as a
  // sentence, not an overline (Type.label defaults to uppercase). ENG-1247.
  vHeadline: { ...Type.label, fontSize: 14, lineHeight: 18, textTransform: "none", letterSpacing: 0 },
  vSub: { ...Type.caption },
});

export default PlanHeaderV3;
