import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Accent, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { formatMacroAdherenceBar } from "@suppr/shared/nutrition/progressWeekReport";
import { formatAdherenceHeadline } from "@suppr/shared/nutrition/adherenceDisplay";
import { isFeatureEnabled } from "@/lib/analytics";

/**
 * ProgressAverageAdherence — Sloe Figma `492:2` "AVERAGE ADHERENCE" card.
 *
 * Big calorie-adherence % + a 5/7-dot on-target streak (sage) + the four
 * macro bars (Protein sage / Carbs clay / Fat amber / Fibre teal). Each
 * bar: label left, value right (with "· over" when over budget), full-width
 * progress bar below. Over-target bars are AMBER (`Accent.warning`), never
 * red — the destructive-red over rule is the calorie-RING carve-out only.
 *
 * Every figure is real (range adherence + `progressRangeStats` macro
 * adherence). The "up N%" week-over-week trend chip only renders when the
 * host supplies a real delta — never fabricated. The host does NOT yet pass
 * `adherenceDeltaPct` because the weekly-aggregate stream isn't persisted
 * (deferred: see ENG-741 weekly aggregate stream); when it lands the chip
 * fills the top-right slot beside the on-target dots.
 *
 * Mirror: `src/app/components/suppr/progress-average-adherence.tsx`.
 */

export interface AdherenceMacroRow {
  name: "Protein" | "Carbs" | "Fat" | "Fibre";
  pct: number;
  color: string;
}

export interface ProgressAverageAdherenceProps {
  adherencePct: number | null;
  onTargetDays: boolean[];
  macros: AdherenceMacroRow[];
  adherenceDeltaPct?: number | null;
}

function SparkleArrow({ up, color }: { up: boolean; color: string }) {
  // Compact up/down chevron-ish glyph for the trend chip.
  return (
    <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
      <Path
        d={up ? "M3 8L6 4L9 8" : "M3 4L6 8L9 4"}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ProgressAverageAdherence({
  adherencePct,
  onTargetDays,
  macros,
  adherenceDeltaPct,
}: ProgressAverageAdherenceProps) {
  const colors = useThemeColors();
  // "AVERAGE ADHERENCE" overline uses accent.primarySolid — scheme-resolved
  // so the deep plum lifts to the OLED-contrast aubergine on dark.
  const accent = useAccent();
  // One-card-treatment soft lift (2026-06-09): the AVERAGE ADHERENCE card sits
  // directly on the Progress page ground, so it takes the soft elevation like
  // every sibling content card (weight / daily-calories / maintenance). Mirrors
  // web `elevation="card"`. Spread onto the OUTER View; the inner bars don't
  // clip the shadow.
  const cardElevation = useCardElevation({ variant: "soft" });
  if (adherencePct == null) return null;
  const sub = colors.textSecondary;
  const text = colors.text;
  // `adherence_over_display` (audit P1-3): above the 110% band the headline
  // flips to an overshoot reading ("11% over", amber) so a >100% number can
  // never read as a *better* score. The flag gates ONLY the over branch; the
  // ≤110% (on/under) path is identical to today's raw `{pct}%`, so a flag
  // flicker can't change a healthy user's number. Mirror: web.
  const overDisplay =
    isFeatureEnabled("adherence_over_display") && adherencePct > 110
      ? formatAdherenceHeadline(adherencePct)
      : null;
  return (
    <View
      testID="progress-average-adherence-card"
      style={[
        {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: CARD_RADIUS,
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.cardBorder,
          padding: 20,
        },
        cardElevation.shadowStyle,
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        {/* headers census 2026-06-10: hand-rolled eyebrow → Type.label token. */}
        <Text style={{ ...Type.label, color: accent.primarySolid }}>
          Average Adherence
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          {adherenceDeltaPct != null && adherenceDeltaPct !== 0 ? (
            <View
              testID="progress-adherence-trend-chip"
              style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}
            >
              <SparkleArrow up={adherenceDeltaPct > 0} color={adherenceDeltaPct > 0 ? Accent.success : sub} />
              <Text style={{ fontSize: 12, fontWeight: "500", color: adherenceDeltaPct > 0 ? Accent.success : sub }}>
                {adherenceDeltaPct > 0 ? "up" : "down"} {Math.abs(adherenceDeltaPct)}%
              </Text>
            </View>
          ) : null}
          {/* On-target streak dots (sage filled / hairline empty).
              ENG-1006 — suppressed entirely when zero days are on target,
              mirroring `<ProgressOnTargetRibbon>`'s "don't show an empty
              achievement" rule. A row of empty grey dots next to a >100%
              headline read as broken/placeholder chrome (the dots are
              this-week-scoped while the headline is range-scoped, so the
              two can legitimately disagree). With nothing to celebrate,
              show nothing rather than a dead dot row. */}
          {onTargetDays.filter(Boolean).length > 0 ? (
            <View
              testID="progress-adherence-streak-dots"
              accessibilityLabel={`${onTargetDays.filter(Boolean).length} of ${onTargetDays.length} days on target`}
              style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
            >
              {onTargetDays.map((on, i) => (
                <View
                  key={i}
                  style={{ width: 9, height: 9, borderRadius: Radius.full, backgroundColor: on ? MacroColors.protein : colors.cardBorder }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>

      {/* ENG-996 — vertical rhythm snapped to the Spacing scale so the
          headline / big % / macro-bar list read with the same calm
          cadence as the sibling weight + THIS WEEK cards. Was a 4/16/12/6
          cascade of off-token gaps; now sm(8) under the overline, lg(20)
          hero-break before the bars, md(16) between rows, sm(8) label→bar.
          Mirror: web `progress-average-adherence.tsx`. */}
      {overDisplay ? (
        // adherence_over_display ON + over target: band-inverted overshoot
        // headline ("11% over"), amber (Accent.warning) not the triumphant
        // raw "111%". The amber matches the macro-bar over treatment, NOT
        // the destructive-red ring carve-out. Mirror: web.
        <Text
          testID="progress-adherence-pct"
          style={{ ...Type.display, fontSize: 40, lineHeight: 44, color: Accent.warning, marginTop: Spacing.sm, fontVariant: ["tabular-nums"] }}
        >
          {overDisplay.value}
          <Text style={{ fontSize: 22, color: Accent.warning }}>{overDisplay.suffix}</Text>
        </Text>
      ) : (
        <Text
          testID="progress-adherence-pct"
          style={{ ...Type.display, fontSize: 40, lineHeight: 44, color: text, marginTop: Spacing.sm, fontVariant: ["tabular-nums"] }}
        >
          {adherencePct}
          <Text style={{ fontSize: 22, color: sub }}>%</Text>
          {/* >100% means "ate over budget on average" — carry the same
              "· over" qualifier the macro rows use, so 110% can't read as
              a triumph stat (fresh-eyes 2026-06-10 P0-2, hero-tone half). */}
          {adherencePct > 100 ? (
            <Text style={{ fontSize: 15, fontWeight: "400", color: sub }}> · over</Text>
          ) : null}
        </Text>
      )}

      <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
        {macros.map(({ name, pct, color }) => {
          const bar = formatMacroAdherenceBar({ adherencePct: pct });
          const tone = bar.isOver ? Accent.warning : color;
          return (
            <View key={name} testID={`progress-adherence-macro-${name.toLowerCase()}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontSize: 13, color: text }}>{name}</Text>
                <Text
                  testID={`progress-adherence-macro-value-${name.toLowerCase()}`}
                  style={{ fontSize: 13, fontWeight: "600", color: text, fontVariant: ["tabular-nums"] }}
                >
                  {bar.label}
                  {bar.isOver ? <Text style={{ color: sub, fontWeight: "400" }}> · over</Text> : null}
                </Text>
              </View>
              {/* §7.3 — adherence-bar track 4–6pt; 6pt keeps the fill
                  legible while reading lighter than the prior 8pt
                  full-width x4 stack (less "tracker dashboard"). */}
              <View style={{ marginTop: Spacing.sm, height: 6, borderRadius: Radius.full, backgroundColor: colors.inputBg, overflow: "hidden" }}>
                <View
                  testID={`progress-adherence-bar-${name.toLowerCase()}`}
                  style={{ height: "100%", width: `${bar.barFillPct}%`, borderRadius: Radius.full, backgroundColor: tone }}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default ProgressAverageAdherence;
