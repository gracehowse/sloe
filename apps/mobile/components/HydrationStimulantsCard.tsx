import * as React from "react";
import { useCallback, useMemo } from "react";
import { View, type ViewStyle } from "react-native";
import { Coffee, Droplet, Wine } from "lucide-react-native";
import { Layout } from "@/constants/layout";
import {
  HydrationQuickAddChip,
  HydrationStimulantRow,
  SloeCard,
} from "@/components/hydration/HydrationStimulantsCardParts";
import {
  ALCOHOL_QUICK_ADDS,
  CAFFEINE_QUICK_ADDS,
  WATER_QUICK_ADDS_ML,
  formatWaterAmount,
  imperialWaterQuickAdds,
  isOverTarget,
  weeklyAlcoholG,
  type StimulantTargets,
} from "@suppr/nutrition-core/hydrationStimulants";

/**
 * HydrationStimulantsCard (mobile) — Sloe TD2 hydration + stimulants.
 * Parity: mirrors web `src/app/components/suppr/hydration-stimulants-card.tsx`.
 * Row/chip chrome extracted to `HydrationStimulantsCardParts` (ENG-1565).
 */

export interface HydrationStimulantsCardProps {
  selectedDateKey: string;
  weekStartDay: "monday" | "sunday";
  targets: StimulantTargets;
  waterTotalMl: number;
  waterFromMealsMl: number;
  caffeineTotalMg: number;
  alcoholByDayG: Record<string, number>;
  measurementSystem?: "metric" | "imperial";
  onAddWater: (ml: number) => void;
  onAddCaffeine: (mg: number, preset?: string | null) => void;
  onAddAlcohol: (grams: number, preset?: string | null) => void;
  onReset: (kind: "water" | "caffeine" | "alcohol") => void;
  style?: ViewStyle;
}

function formatWaterLine(ml: number, system: "metric" | "imperial"): string {
  const { value, unit } = formatWaterAmount(ml, system);
  return `${value} ${unit}`;
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
  const waterPct = targets.waterMl > 0 ? (waterTotalMl / targets.waterMl) * 100 : 0;
  const caffeinePct = targets.caffeineMg > 0 ? (caffeineTotalMg / targets.caffeineMg) * 100 : 0;
  const alcoholPct = targets.alcoholGWeekly > 0 ? (weeklyAlcohol / targets.alcoholGWeekly) * 100 : 0;
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
  const waterValueLine = `${formatWaterLine(waterTotalMl, measurementSystem)} / ${formatWaterLine(targets.waterMl, measurementSystem)}`;

  return (
    <View accessibilityLabel="Hydration and stimulants" style={[{ gap: Layout.todaySectionCardGap }, style]}>
      <SloeCard title="Hydration" testID="today-hydration-card">
        <HydrationStimulantRow
          tone="water"
          label="Water"
          icon={Droplet}
          value={waterValueLine}
          unitSuffix=""
          emphasizeValue
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
            <HydrationQuickAddChip
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
        </HydrationStimulantRow>
      </SloeCard>

      {showCaffeine || showAlcohol ? (
        <SloeCard title="Stimulants" rightLabel="This week" testID="today-stimulants-card">
          {showCaffeine ? (
            <HydrationStimulantRow
              tone="caffeine"
              label="Caffeine"
              icon={Coffee}
              value={`${Math.round(caffeineTotalMg)} / ${targets.caffeineMg}`}
              unitSuffix="mg"
              pct={caffeinePct}
              overTarget={caffeineOver}
              overCopy={`Over ${targets.caffeineMg} mg`}
              onReset={() => onReset("caffeine")}
            >
              {CAFFEINE_QUICK_ADDS.slice(0, 4).map((preset) => (
                <HydrationQuickAddChip
                  key={preset.label}
                  tone="caffeine"
                  label={`+${preset.label} (${preset.mg}mg)`}
                  accessibilityLabel={`Add ${preset.label}: ${preset.mg} milligrams caffeine`}
                  onPress={() => handleCaffeine(preset.mg, preset.label)}
                />
              ))}
            </HydrationStimulantRow>
          ) : null}

          {showAlcohol ? (
            <HydrationStimulantRow
              tone="alcohol"
              label="Alcohol"
              icon={Wine}
              value={`${weeklyAlcohol} / ${targets.alcoholGWeekly}`}
              unitSuffix="g this week"
              pct={alcoholPct}
              overTarget={alcoholOver}
              overCopy="Over limit"
              topBorder={showCaffeine}
              onReset={() => onReset("alcohol")}
            >
              {ALCOHOL_QUICK_ADDS.map((preset) => (
                <HydrationQuickAddChip
                  key={preset.label}
                  tone="alcohol"
                  label={`+${preset.label} (${preset.grams}g)`}
                  accessibilityLabel={`Add ${preset.label}: ${preset.grams} grams alcohol`}
                  onPress={() => handleAlcohol(preset.grams, preset.label)}
                />
              ))}
            </HydrationStimulantRow>
          ) : null}
        </SloeCard>
      ) : null}
    </View>
  );
}
