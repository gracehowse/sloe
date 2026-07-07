import { Text, View, type TextStyle } from "react-native";
import { Accent, FontFamily, Spacing, Type } from "@/constants/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  PRODUCT_TDEE_LABEL_GLOSS,
  PRODUCT_TDEE_LABEL_PLAIN,
} from "@suppr/shared/onboarding/figmaCopy";
import { ProgressEnergyEquation } from "./ProgressEnergyEquation";

/**
 * ProgressEnergyTriad — Sloe Figma `492:2` AVG INTAKE / EST. TDEE / DEFICIT
 * three-cell row.
 *
 * Three separate cream cells (not one divided card, per the frame):
 *   - AVG INTAKE — range avg calories/day (neutral).
 *   - EST. TDEE — resolved maintenance; SAGE value + "ADAPTIVE" sub-label
 *     when the engine value won (else "FORMULA").
 *   - DEFICIT — maintenance − avg intake; the result reads in PLUM (the brand
 *     headline accent, matching the v3 prototype's Progress energy-balance
 *     `deficit → var(--primary-active)`, Sloe-App.html L5010), AMBER "surplus"
 *     when intake exceeds maintenance. NB: this differs from the Today
 *     NetEnergy card where a *deficit is the good state* and reads sage.
 *
 * All numbers are real (range stats + resolved maintenance). Cells render
 * "—" when the underlying value isn't available yet — never fabricated.
 *
 * Mirror: `src/app/components/suppr/progress-energy-triad.tsx`.
 */

export interface ProgressEnergyTriadProps {
  /** Range average calories/day. Null → "—". */
  avgIntakeKcal: number | null;
  /** Resolved maintenance (TDEE) kcal. Null → "—". */
  maintenanceKcal: number | null;
  /** True when the resolved maintenance is the adaptive (engine) value. */
  isAdaptive: boolean;
}

export function ProgressEnergyTriad({
  avgIntakeKcal,
  maintenanceKcal,
  isAdaptive,
}: ProgressEnergyTriadProps) {
  const colors = useThemeColors();
  const isDark = useColorScheme() === "dark";
  const dim = colors.textTertiary;
  const text = colors.text;
  // EST. TDEE / maintenance = scheme-aware sage (AA solid on light, lighter on
  // Nocturne). The DEFICIT result = plum (the brand headline accent) via the one
  // scheme-resolved plum source. Both were MacroColors.protein, which the v3
  // recolour turned plum — that made TDEE wrong (should be sage) AND left the
  // dark-mode sage too dark; this splits + schemes them. ENG-1225 token-role,
  // grounded on Sloe-App.html Progress energy-balance L5008/L5010.
  const sage = isDark ? Accent.successLight : Accent.successSolid;
  const plum = colors.navPrimary;

  const deficitKcal =
    avgIntakeKcal != null && maintenanceKcal != null && maintenanceKcal > 0
      ? Math.round(maintenanceKcal - avgIntakeKcal)
      : null;
  const isSurplus = deficitKcal != null && deficitKcal < 0;

  // ENG-1461 — jargon gloss (product-wide extension of ENG-1187). Leads
  // with plain English, acronym secondary; shared pair + flag with web,
  // pricing, and the weekly check-in so the concept never has more than
  // one label. Mirror of `src/app/components/suppr/progress-energy-triad.tsx`.
  const tdeeCellLabel = isFeatureEnabled("onboarding_jargon_gloss_v1")
    ? PRODUCT_TDEE_LABEL_GLOSS
    : PRODUCT_TDEE_LABEL_PLAIN;

  // Sloe v3 (ENG-1225, Block 8): the prototype's Progress energy balance is an
  // EQUATION (intake − maintenance = deficit/day) with a "How maintenance works"
  // explainer, not a 3-cell triad (Sloe-App.html L5001-5018). Mirrors the web
  // twin's flag gate; the legacy triad stays in the else until collapsed.
  if (isFeatureEnabled("sloe_v3_energy_equation")) {
    return (
      <ProgressEnergyEquation
        avgIntakeKcal={avgIntakeKcal}
        maintenanceKcal={maintenanceKcal}
        deficitKcal={deficitKcal}
        isSurplus={isSurplus}
        isAdaptive={isAdaptive}
      />
    );
  }

  // headers census 2026-06-10: triad eyebrow → Type.label token.
  const eyebrow: TextStyle = { ...Type.label, color: dim };
  const value: TextStyle = {
    // Sloe v3 (ENG-1247): serif numerals (Newsreader) — parity with the web
    // twin (now `font-headline` / 22) + the v3 `ProgressEnergyEquation` + every
    // other Sloe numeral (ring / macro / daily-calories). Was the lone sans/700
    // numeral. 22 is on the ENG-119 type scale; serif 500 is a loaded weight.
    fontFamily: FontFamily.serifMedium,
    fontSize: 22,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
    marginTop: Spacing.xs,
  };

  return (
    <View testID="progress-energy-triad" style={{ flexDirection: "row", gap: 8 }}>
      <SupprCard
        testID="progress-energy-avg-intake"
        // One-card-treatment soft lift (2026-06-09): each triad cell is its own
        // card sitting directly on the page ground (not nested), so all three
        // take the soft lift like the sibling cards. Mirrors web `elevation="card"`.
        lift="flat"
        padding="none"
        innerStyle={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 }}
        style={{ flex: 1 }}
      >
        <Text style={eyebrow}>Avg intake</Text>
        <Text style={[value, { color: text }]}>
          {avgIntakeKcal != null ? avgIntakeKcal.toLocaleString() : "—"}
        </Text>
      </SupprCard>

      <SupprCard
        testID="progress-energy-tdee"
        lift="flat"
        padding="none"
        innerStyle={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 }}
        style={{ flex: 1 }}
      >
        <Text style={eyebrow}>{tdeeCellLabel}</Text>
        <Text style={[value, { color: sage }]}>
          {maintenanceKcal != null && maintenanceKcal > 0
            ? maintenanceKcal.toLocaleString()
            : "—"}
        </Text>
        {/* headers census 2026-06-10: 9px sub-label → Type.label (kills the
            sub-ramp 9px; pill hue kept). */}
        {maintenanceKcal != null && maintenanceKcal > 0 ? (
          <Text style={{ ...Type.label, color: sage, marginTop: 2 }}>
            {isAdaptive ? "Adaptive" : "Formula"}
          </Text>
        ) : null}
      </SupprCard>

      <SupprCard
        testID="progress-energy-deficit"
        lift="flat"
        padding="none"
        innerStyle={{ alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 }}
        style={{ flex: 1 }}
      >
        <Text style={eyebrow}>Deficit</Text>
        <Text
          style={[
            value,
            {
              color: isSurplus
                ? Accent.warning
                : deficitKcal != null && deficitKcal > 0
                  ? plum
                  : text,
            },
          ]}
        >
          {deficitKcal != null
            ? deficitKcal > 0
              ? `−${deficitKcal.toLocaleString()}`
              : deficitKcal === 0
                ? "0"
                : `+${Math.abs(deficitKcal).toLocaleString()}`
            : "—"}
        </Text>
        {/* headers census 2026-06-10: 9px sub-label → Type.label. */}
        {isSurplus ? (
          <Text style={{ ...Type.label, color: Accent.warningSolid, marginTop: 2 }}>
            Surplus
          </Text>
        ) : null}
      </SupprCard>
    </View>
  );
}

export default ProgressEnergyTriad;
