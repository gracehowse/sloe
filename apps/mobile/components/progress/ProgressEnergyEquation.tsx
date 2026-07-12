import { useState } from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { ChevronDown, ChevronRight } from "lucide-react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { Accent, FontFamily, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * ProgressEnergyEquation — Sloe v3 Progress energy balance as an EQUATION
 * (intake − maintenance = deficit/day) with a "How maintenance works" explainer.
 *
 * 1:1 mobile port of the web twin (`src/app/components/suppr/progress-energy-triad.tsx`
 * `ProgressEnergyEquation`), gated behind `sloe_v3_energy_equation`. Matches the
 * prototype (Sloe-App.html Progress energy-balance L5001-5018). Maintenance reads
 * sage; a deficit reads plum (the brand headline accent — NB this differs from the
 * Today NetEnergy card where a deficit is the *good* state and reads sage); a
 * surplus reads amber. Null inputs render "—".
 */
export interface ProgressEnergyEquationProps {
  avgIntakeKcal: number | null;
  maintenanceKcal: number | null;
  deficitKcal: number | null;
  isSurplus: boolean;
  isAdaptive: boolean;
  /** ENG-1506 — explicit source qualifier under the equation, gated by the
   *  host (`energy_numbers_v1`). Null → legacy render. */
  qualifierLine?: string | null;
  /** ENG-1506 — REAL selected-period label for the header; null → the
   *  legacy hard-coded "7-day average". */
  periodLabel?: string | null;
}

export function ProgressEnergyEquation({
  avgIntakeKcal,
  maintenanceKcal,
  deficitKcal,
  isSurplus,
  isAdaptive,
  qualifierLine,
  periodLabel,
}: ProgressEnergyEquationProps) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === "dark";
  const [showHow, setShowHow] = useState(false);

  const sage = isDark ? Accent.successLight : Accent.successSolid;
  const plum = colors.navPrimary;
  const dim = colors.textTertiary;
  const hasMaintenance = maintenanceKcal != null && maintenanceKcal > 0;

  const resultValue =
    deficitKcal == null
      ? "—"
      : deficitKcal > 0
        ? `−${deficitKcal.toLocaleString()}`
        : deficitKcal === 0
          ? "0"
          : `+${Math.abs(deficitKcal).toLocaleString()}`;
  const resultColor = isSurplus
    ? Accent.warning
    : deficitKcal != null && deficitKcal > 0
      ? plum
      : colors.text;

  // ENG-1497 — no radius override: the 8px lg-ladder escape made this the
  // one square card on Progress (Grace, 2026-07-11). 24 card default.
  return (
    <SupprCard testID="progress-energy-equation" lift="soft" padding="lg">
      {/* ENG-1506 — honest window label (avg intake follows the period
          control); legacy hard-coded text when the flag is off. */}
      <Text style={[styles.eyebrow, { color: dim }]}>
        {periodLabel ? `Energy balance · ${periodLabel}` : "Energy balance · 7-day average"}
      </Text>
      <View style={styles.row}>
        <EqTerm
          label="Avg intake"
          value={avgIntakeKcal != null ? avgIntakeKcal.toLocaleString() : "—"}
          color={colors.text}
          dim={dim}
        />
        <EqOp color={dim}>−</EqOp>
        <EqTerm
          label="Maintenance"
          value={hasMaintenance ? maintenanceKcal!.toLocaleString() : "—"}
          color={sage}
          dim={dim}
        />
        <EqOp color={dim}>=</EqOp>
        <EqTerm
          label={isSurplus ? "Surplus/day" : "Deficit/day"}
          value={resultValue}
          color={resultColor}
          dim={dim}
        />
      </View>
      {/* ENG-1506 — explicit source qualifier under the equation. */}
      {qualifierLine && hasMaintenance ? (
        <Text
          testID="progress-energy-equation-qualifier"
          style={{ ...Type.captionSmall, color: dim, marginTop: Spacing.sm }}
        >
          Maintenance: {qualifierLine}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setShowHow((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showHow }}
        accessibilityLabel="How maintenance works"
        testID="progress-energy-how"
        hitSlop={6}
        style={styles.howBtn}
      >
        <Text style={[styles.howText, { color: plum }]}>How maintenance works</Text>
        {showHow ? (
          <ChevronDown size={14} color={plum} strokeWidth={2.25} />
        ) : (
          <ChevronRight size={14} color={plum} strokeWidth={2.25} />
        )}
      </Pressable>
      {showHow ? (
        <Text style={[styles.explainer, { color: colors.textSecondary }]}>
          Maintenance (your TDEE) is what you&apos;d burn on a normal day. Sloe
          starts from a formula, then{" "}
          <Text style={{ fontWeight: "700", color: colors.text }}>adapts</Text> to
          your real weight trend and logging — so it gets truer the more you use
          it.
          {hasMaintenance ? (
            <>
              {" "}
              You&apos;re currently on the{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {isAdaptive ? "adaptive estimate" : "formula estimate"}
              </Text>
              .
            </>
          ) : null}
        </Text>
      ) : null}
    </SupprCard>
  );
}

function EqTerm({
  label,
  value,
  color,
  dim,
}: {
  label: string;
  value: string;
  color: string;
  dim: string;
}) {
  return (
    <View style={styles.term}>
      <Text style={[styles.termValue, { color }]}>{value}</Text>
      <Text style={[styles.termLabel, { color: dim }]}>{label}</Text>
    </View>
  );
}

function EqOp({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Text style={[styles.op, { color }]} accessibilityElementsHidden>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...Type.label },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4,
    marginTop: Spacing.dense,
  },
  term: { flex: 1, minWidth: 0, alignItems: "center" },
  termValue: {
    // Sloe v3 (ENG-1247): serif numerals (Newsreader) like every other Sloe
    // numeral — ring / macro / the sibling daily-calories avg — and the v3
    // prototype `.prog-bal-v` (serif, medium). Was the lone sans/700 equation
    // row. 22 is on the type ramp (the prototype's 25 is off-ramp and risks the
    // 3-term row overflowing on narrow phones); serif weight 500 is a loaded
    // Newsreader weight (400/500/600).
    fontFamily: FontFamily.serifMedium,
    fontSize: 22,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    lineHeight: 26,
  },
  termLabel: { ...Type.statLabel, fontSize: 10, marginTop: 4 },
  op: { fontSize: 18, fontWeight: "300", paddingBottom: 12 },
  howBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.dense,
    alignSelf: "flex-start",
  },
  howText: { ...Type.label, fontSize: 13, textTransform: "none", letterSpacing: 0 },
  explainer: { ...Type.caption, fontSize: 13, lineHeight: 19, marginTop: Spacing.sm },
});

export default ProgressEnergyEquation;
