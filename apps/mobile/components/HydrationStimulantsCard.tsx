import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Radius, Spacing, StimulantColors } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ALCOHOL_QUICK_ADDS,
  CAFFEINE_QUICK_ADDS,
  WATER_QUICK_ADDS_ML,
  formatWaterAmount,
  imperialWaterQuickAdds,
  isOverTarget,
  weeklyAlcoholG,
  type StimulantTargets,
} from "../../../src/lib/nutrition/hydrationStimulants";

/**
 * HydrationStimulantsCard (mobile).
 *
 * Parity: mirrors the web card at
 * `src/app/components/suppr/hydration-stimulants-card.tsx`.
 * Presets, labels, and "Over limit" / "Over 400 mg" copy are identical.
 *
 * Rules:
 *   - Caffeine row is hidden when `targets.caffeineMg === 0`.
 *   - Alcohol row is hidden when `targets.alcoholGWeekly === 0`.
 *
 * Accessibility: every chip has `accessibilityRole="button"` and an
 * `accessibilityLabel` that names quantity + stimulant.
 */

export interface HydrationStimulantsCardProps {
  selectedDateKey: string;
  weekStartDay: "monday" | "sunday";
  targets: StimulantTargets;
  waterTotalMl: number;
  waterFromMealsMl: number;
  caffeineTotalMg: number;
  alcoholByDayG: Record<string, number>;
  /**
   * Display-unit preference — only affects water rendering (chips, progress
   * line, "from logged food" sub-line). Caffeine stays in mg and alcohol in
   * grams on both systems. Defaults to `"metric"` so callers that haven't
   * yet loaded the profile preference don't silently flip to imperial.
   */
  measurementSystem?: "metric" | "imperial";
  onAddWater: (ml: number) => void;
  onAddCaffeine: (mg: number, preset?: string | null) => void;
  onAddAlcohol: (grams: number, preset?: string | null) => void;
  onReset: (kind: "water" | "caffeine" | "alcohol") => void;
  style?: ViewStyle;
}

function formatWaterLine(
  ml: number,
  system: "metric" | "imperial",
): string {
  const { value, unit } = formatWaterAmount(ml, system);
  return `${value} ${unit}`;
}

const COLORS: Record<"water" | "caffeine" | "alcohol", string> = {
  water: MacroColors.water, // cyan (shared --macro-water token)
  caffeine: StimulantColors.caffeine, // violet — mirrors web --stimulant-caffeine
  alcohol: Accent.warning, // amber; over-target label also uses amber
};

function Row({
  label,
  icon,
  tone,
  valueLine,
  secondaryLine,
  pct,
  overTarget,
  overCopy,
  children,
  onReset,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "water" | "caffeine" | "alcohol";
  valueLine: string;
  secondaryLine?: string;
  pct: number;
  overTarget: boolean;
  overCopy: string;
  children: React.ReactNode;
  onReset: () => void;
}) {
  const colors = useThemeColors();
  const [menuOpen, setMenuOpen] = useState(false);
  const barColor = overTarget ? Accent.warning : COLORS[tone];
  return (
    <View style={{ paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0, maxWidth: 140 }}>
          <Ionicons name={icon} size={16} color={COLORS[tone]} />
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{label}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: colors.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {valueLine}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${label} row more options`}
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              style={{ padding: 2 }}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View
            accessibilityRole="progressbar"
            style={{
              width: "100%",
              maxWidth: 220,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, pct))}%`,
                height: "100%",
                borderRadius: 3,
                backgroundColor: barColor,
              }}
            />
          </View>
          {secondaryLine ? (
            <Text style={{ fontSize: 10, color: colors.textTertiary }}>{secondaryLine}</Text>
          ) : null}
          {overTarget ? (
            <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.warning }}>
              {overCopy}
            </Text>
          ) : null}
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          justifyContent: "flex-end",
          marginTop: Spacing.xs,
        }}
      >
        {children}
      </View>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          onPress={() => setMenuOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
        >
          <View
            style={{
              minWidth: 220,
              backgroundColor: colors.card,
              borderRadius: Radius.md,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: Spacing.sm }}>
              {label} — more
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reset today's ${label.toLowerCase()}`}
              onPress={() => {
                onReset();
                setMenuOpen(false);
              }}
              style={{ paddingVertical: 10 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Reset today</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setMenuOpen(false)}
              style={{ paddingVertical: 10 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Chip({
  tone,
  label,
  accessibilityLabel,
  onPress,
}: {
  tone: "water" | "caffeine" | "alcohol";
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const color = COLORS[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: Radius.sm,
        backgroundColor: color + "22",
        borderWidth: 1,
        borderColor: color + "55",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color }}>{label}</Text>
    </Pressable>
  );
}

export function HydrationStimulantsCard({
  selectedDateKey,
  weekStartDay,
  targets,
  waterTotalMl,
  waterFromMealsMl,
  caffeineTotalMg,
  alcoholByDayG,
  measurementSystem = "metric",
  onAddWater,
  onAddCaffeine,
  onAddAlcohol,
  onReset,
  style,
}: HydrationStimulantsCardProps) {
  const colors = useThemeColors();
  const showCaffeine = targets.caffeineMg > 0;
  const showAlcohol = targets.alcoholGWeekly > 0;
  const waterChips = useMemo(
    () =>
      measurementSystem === "imperial"
        ? imperialWaterQuickAdds()
        : WATER_QUICK_ADDS_ML.map((ml) => ({ ml, label: `${ml} ml` })),
    [measurementSystem],
  );

  const weeklyAlcohol = useMemo(
    () => weeklyAlcoholG(alcoholByDayG, selectedDateKey, weekStartDay),
    [alcoholByDayG, selectedDateKey, weekStartDay],
  );

  const waterPct =
    targets.waterMl > 0 ? (waterTotalMl / targets.waterMl) * 100 : 0;
  const caffeinePct =
    targets.caffeineMg > 0 ? (caffeineTotalMg / targets.caffeineMg) * 100 : 0;
  const alcoholPct =
    targets.alcoholGWeekly > 0 ? (weeklyAlcohol / targets.alcoholGWeekly) * 100 : 0;

  const caffeineOver = isOverTarget(caffeineTotalMg, targets.caffeineMg);
  const alcoholOver = isOverTarget(weeklyAlcohol, targets.alcoholGWeekly);

  const handleCaffeine = useCallback(
    (mg: number, preset?: string | null) => onAddCaffeine(mg, preset ?? null),
    [onAddCaffeine],
  );
  const handleAlcohol = useCallback(
    (g: number, preset?: string | null) => onAddAlcohol(g, preset ?? null),
    [onAddAlcohol],
  );

  return (
    <View
      accessibilityLabel="Hydration and stimulants"
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: Radius.lg,
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: Spacing.xs,
        }}
      >
        Hydration & stimulants
      </Text>

      <Row
        tone="water"
        label="Water"
        icon="water-outline"
        valueLine={`${formatWaterLine(waterTotalMl, measurementSystem)} / ${formatWaterLine(targets.waterMl, measurementSystem)}`}
        secondaryLine={
          waterFromMealsMl > 0
            ? `Includes ${formatWaterLine(waterFromMealsMl, measurementSystem)} from logged food`
            : undefined
        }
        pct={waterPct}
        overTarget={false}
        overCopy=""
        onReset={() => onReset("water")}
      >
        {waterChips.map((chip) => (
          <Chip
            key={chip.ml}
            tone="water"
            label={`+${chip.label}`}
            accessibilityLabel={
              measurementSystem === "imperial"
                ? `Add ${chip.label} water`
                : `Add ${chip.ml} millilitres water`
            }
            onPress={() => onAddWater(chip.ml)}
          />
        ))}
      </Row>

      {showCaffeine ? (
        <Row
          tone="caffeine"
          label="Caffeine"
          icon="cafe-outline"
          valueLine={`${Math.round(caffeineTotalMg)} / ${targets.caffeineMg} mg`}
          pct={caffeinePct}
          overTarget={caffeineOver}
          overCopy={`Over ${targets.caffeineMg} mg`}
          onReset={() => onReset("caffeine")}
        >
          {CAFFEINE_QUICK_ADDS.slice(0, 4).map((preset) => (
            <Chip
              key={preset.label}
              tone="caffeine"
              label={`+${preset.label} (${preset.mg}mg)`}
              accessibilityLabel={`Add ${preset.label}: ${preset.mg} milligrams caffeine`}
              onPress={() => handleCaffeine(preset.mg, preset.label)}
            />
          ))}
        </Row>
      ) : null}

      {showAlcohol ? (
        <Row
          tone="alcohol"
          label="Alcohol"
          icon="wine-outline"
          valueLine={`${weeklyAlcohol} / ${targets.alcoholGWeekly} g this week`}
          pct={alcoholPct}
          overTarget={alcoholOver}
          overCopy="Over limit"
          onReset={() => onReset("alcohol")}
        >
          {ALCOHOL_QUICK_ADDS.map((preset) => (
            <Chip
              key={preset.label}
              tone="alcohol"
              label={`+${preset.label} (${preset.grams}g)`}
              accessibilityLabel={`Add ${preset.label}: ${preset.grams} grams alcohol`}
              onPress={() => handleAlcohol(preset.grams, preset.label)}
            />
          ))}
        </Row>
      ) : null}
    </View>
  );
}

