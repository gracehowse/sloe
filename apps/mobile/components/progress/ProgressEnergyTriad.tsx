import { Text, View, type TextStyle } from "react-native";
import { Accent, MacroColors, Spacing, Type } from "@/constants/theme";
import { SupprCard } from "@/components/ui/SupprCard";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * ProgressEnergyTriad — Sloe Figma `492:2` AVG INTAKE / EST. TDEE / DEFICIT
 * three-cell row.
 *
 * Three separate cream cells (not one divided card, per the frame):
 *   - AVG INTAKE — range avg calories/day.
 *   - EST. TDEE — resolved maintenance; SAGE value + "ADAPTIVE" sub-label
 *     when the engine value won (else "FORMULA").
 *   - DEFICIT — maintenance − avg intake; SAGE when a real deficit, AMBER
 *     "surplus" when intake exceeds maintenance.
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
  const dim = colors.textTertiary;
  const text = colors.text;
  // Sage (protein/olive) for TDEE + a real deficit; amber for a surplus.
  const sage = MacroColors.protein;

  const deficitKcal =
    avgIntakeKcal != null && maintenanceKcal != null && maintenanceKcal > 0
      ? Math.round(maintenanceKcal - avgIntakeKcal)
      : null;
  const isSurplus = deficitKcal != null && deficitKcal < 0;

  // headers census 2026-06-10: triad eyebrow → Type.label token.
  const eyebrow: TextStyle = { ...Type.label, color: dim };
  const value: TextStyle = {
    // 18 (on the ENG-119 type scale), matching the web twin
    // (suppr/progress-energy-triad.tsx text-[18px]). Was off-scale 20.
    fontSize: 18,
    fontWeight: "700",
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
        <Text style={eyebrow}>Est. TDEE</Text>
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
                  ? sage
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
          <Text style={{ ...Type.label, color: Accent.warning, marginTop: 2 }}>
            Surplus
          </Text>
        ) : null}
      </SupprCard>
    </View>
  );
}

export default ProgressEnergyTriad;
