import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import type { PlanDayStatus } from "@suppr/shared/planning/planWeekStatus";

/**
 * PlanWeekStripV3 — Sloe v3 Plan week strip / day selector.
 *
 * Parity with the prototype (`docs/ux/redesign/v3/Sloe-App.html` Plan `pweek`
 * ~L4725-4734): a 7-cell row, each cell = day letter + date numeral + a 3-state
 * status ring (full = sage / part = amber / empty = hollow outline) folded into
 * navigation. The status ring keeps its real colour whatever the selection
 * state; today (when not selected) tints its letter the brand accent.
 *
 * ## Selection is a soft plum DISC (`design_consistency_v1`, 2026-07-24)
 * The selected day's numeral sits inside a circular `Radius.full` disc filled
 * with `accent.primarySoftStrong` and NO border — the same treatment Today's
 * `charts/DayStrip` uses, so the product's two week strips finally say
 * "selected" the same way.
 *
 * Why a disc, and not the hairline rounded rectangle the day-strip convergence
 * briefly reached for: a 1px grey rounded-rect around a number reads as a
 * focused text input or a spreadsheet cell — an affordance, not a state — and
 * carries no brand colour at all. Circular is this app's signature geometry
 * (the hero ring, the avatar chip, the FAB, the macro dots), and the tint says
 * "selected" in plum rather than in border-grey. Sized 28pt so seven cells
 * still fit a 375pt screen, and filled rather than stroked so selecting a day
 * can never shift layout. SoftStrong (20%) rather than Soft (12%): at 12% over
 * the Warm Oat ground the disc desaturates to a grey smudge and reads as chrome
 * instead of as a plum state.
 *
 * ## The flag is a real kill switch
 * With `design_consistency_v1` OFF this reproduces the treatment that actually
 * shipped before the pass — the whole cell floods plum with an inverted white
 * letter / numeral / status ring — rather than the selection-less strip the
 * consistency pass briefly left behind (a kill switch that lands you somewhere
 * the product has never been is not a kill switch).
 *
 * Presentational — the host derives each day's status from the real week plan
 * (`computePlanDayStatus`) and owns the selected-day state. Behind sloe_v3_plan.
 */
export interface PlanWeekStripDay {
  /** Stable key (e.g. the day's ISO date or index). */
  key: string;
  /** Single-letter weekday, e.g. "M". */
  dayLetter: string;
  /** Date numeral, e.g. 16. */
  dateNum: number;
  status: PlanDayStatus;
  isToday: boolean;
}

export interface PlanWeekStripV3Props {
  days: PlanWeekStripDay[];
  selectedKey: string;
  onSelectDay: (key: string) => void;
}

export function PlanWeekStripV3({
  days,
  selectedKey,
  onSelectDay,
}: PlanWeekStripV3Props) {
  const colors = useThemeColors();
  // Scheme-resolved accent (never the static `Accent`) so the disc tint and the
  // legacy on-accent ink both invert correctly in dark mode.
  const accent = useAccent();
  // design_consistency_v1 — the soft plum selection disc, shared with Today's
  // `charts/DayStrip`. OFF reproduces the pre-pass plum-filled cell verbatim.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  return (
    <View style={styles.strip} accessibilityRole="tablist">
      {days.map((d) => {
        const selected = d.key === selectedKey;
        // LEGACY ONLY (flag OFF): the whole cell floods plum and every glyph
        // inverts to the on-accent ink.
        const legacyFill = !unifiedChrome && selected;
        const ringColor =
          d.status === "full"
            ? Accent.success
            : d.status === "part"
              ? Accent.warning
              : "transparent";
        const isHollow = d.status === "empty";
        return (
          <PressableScale
            key={d.key}
            onPress={() => onSelectDay(d.key)}
            haptic="selection"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${d.dayLetter} ${d.dateNum}`}
            style={[
              styles.cell,
              legacyFill && { backgroundColor: colors.navPrimary },
            ]}
          >
            <Text
              style={[
                styles.letter,
                {
                  color: legacyFill
                    ? accent.primaryForeground
                    : d.isToday
                      ? colors.navPrimary
                      : colors.textTertiary,
                },
              ]}
            >
              {d.dayLetter}
            </Text>
            <View
              testID={
                unifiedChrome && selected
                  ? "planweekstrip-selected-disc"
                  : undefined
              }
              style={
                unifiedChrome
                  ? [
                      styles.disc,
                      selected && {
                        backgroundColor: accent.primarySoftStrong,
                      },
                    ]
                  : undefined
              }
            >
              <Text
                style={[
                  styles.date,
                  {
                    color: legacyFill ? accent.primaryForeground : colors.text,
                  },
                ]}
              >
                {d.dateNum}
              </Text>
            </View>
            <View
              style={[
                styles.ring,
                {
                  backgroundColor: legacyFill
                    ? accent.primaryForeground
                    : isHollow
                      ? "transparent"
                      : ringColor,
                  borderWidth: isHollow && !legacyFill ? 1 : 0,
                  borderColor: colors.borderStrong,
                },
              ]}
            />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", gap: 6, marginTop: Spacing.md },
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "transparent",
  },
  letter: { ...Type.statLabel, fontSize: 11 },
  disc: {
    minWidth: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.full,
  },
  date: { fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
  ring: { width: 7, height: 7, borderRadius: Radius.full },
});

export default PlanWeekStripV3;
