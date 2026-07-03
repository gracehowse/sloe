import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Coffee, Droplet, Ellipsis, Wine, type LucideIcon } from "lucide-react-native";
import { Layout } from "@/constants/layout";
import { Accent, Radius, Spacing, StimulantColors, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useMacroColors } from "@/lib/macroColors";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprCard } from "@/components/ui/SupprCard";
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
 * HydrationStimulantsCard (mobile) — Sloe `TD2 · Hydration & stimulants`
 * re-skin (Today re-skin unit 3, 2026-06-03). Figma 463:2 /
 * `docs/prototypes/stitch-sloe/today-hydration.html`.
 *
 * The TD2 frame splits the single legacy card into TWO Sloe cards:
 *   - "Hydration" — a full-width Water row (Newsreader value over a track)
 *     + a grid of quick-add chips.
 *   - "Stimulants" — Caffeine + Caffeine rows in the same grammar, each
 *     self-hiding when its target is 0 (the Settings opt-in path). When
 *     neither stimulant is opted in, the whole Stimulants card is omitted.
 *
 * Re-skin only — NO data-flow or logic change. Every handler, the
 * caffeine/alcohol Settings opt-in self-hide, the reset menu, and the
 * storage-stays-metric invariant are preserved byte-for-byte.
 *
 * Parity: mirrors the web card at
 * `src/app/components/suppr/hydration-stimulants-card.tsx`.
 * Presets, labels, and "Over limit" / "Over 400 mg" copy are identical.
 *
 * Rules: caffeine row hidden when `targets.caffeineMg === 0`; alcohol when `targets.alcoholGWeekly === 0`.
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

// Scheme-aware (ENG-1223): `water` takes the resolved --macro-water from `useMacroColors()`; caffeine/alcohol are scheme-neutral tokens.
function tones(water: string): Record<"water" | "caffeine" | "alcohol", string> {
  return { water, caffeine: StimulantColors.caffeine, alcohol: Accent.warning };
}

/**
 * SloeCard — the Hydration / Stimulants section card. Card CHROME (warm-grey
 * fill, radius 20, soft lift on an outer wrapper, corner-clip, hairline) is the
 * shared <SupprCard> shell — this just adds the section's title row + content
 * padding. No more hand-rolled per-card chrome (Grace 2026-06-04 consolidation).
 */
function SloeCard({
  title,
  rightLabel,
  children,
  testID,
  accessibilityLabel,
  style,
}: {
  title: string;
  rightLabel?: string;
  children: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
}) {
  const colors = useThemeColors();
  return (
    <SupprCard
      // Section card sits on the page ground → soft lift (one-treatment, Grace 2026-06-09).
      lift="soft"
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      padding="none"
      style={style}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.sm,
        }}
      >
        <Text style={{ ...Type.headline, color: colors.navPrimary }}>{title}</Text>
        {rightLabel ? (
          <Text style={{ ...Type.caption, color: colors.textTertiary }}>{rightLabel}</Text>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>{children}</View>
    </SupprCard>
  );
}

/**
 * Row — one tracked quantity (Water / Caffeine / Alcohol). SLOE `TD2`
 * grammar: a left icon + label, a right-aligned Newsreader value with its
 * unit, a full-width progress track underneath, then the quick-add chip
 * grid. The "more" (reset) affordance is an ellipsis on the value row, and
 * over-target copy + the "from logged food" sub-line are preserved.
 */
function Row({
  label,
  icon: Icon,
  tone,
  value,
  unitSuffix,
  secondaryLine,
  pct,
  overTarget,
  overCopy,
  emphasizeValue,
  topBorder,
  children,
  onReset,
}: {
  label: string;
  icon: LucideIcon;
  tone: "water" | "caffeine" | "alcohol";
  value: string;
  unitSuffix: string;
  secondaryLine?: string;
  pct: number;
  overTarget: boolean;
  overCopy: string;
  /** Water uses a larger (2xl) numeral in the frame; stimulants use base. */
  emphasizeValue?: boolean;
  /** Hairline separator above the row (stimulants stack two rows). */
  topBorder?: boolean;
  children: React.ReactNode;
  onReset: () => void;
}) {
  const colors = useThemeColors(), tone$ = tones(useMacroColors().colors.water);
  const cardElevation = useCardElevation();
  const [menuOpen, setMenuOpen] = useState(false);
  const barColor = overTarget ? Accent.warning : tone$[tone];
  return (
    <View
      style={{
        paddingTop: topBorder ? Spacing.md : 0,
        // Sloe: hairline `border-t border-line` between stacked stimulant rows.
        borderTopWidth: topBorder ? StyleSheet.hairlineWidth : 0,
        borderTopColor: colors.border,
        marginTop: topBorder ? Spacing.md : 0,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: Spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 }}>
          <Icon size={18} color={tone$[tone]} />
          <Text numberOfLines={1} style={{ ...Type.bodyLarge, color: colors.text }}>
            {label}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <Text
            style={{
              ...(emphasizeValue ? Type.title : Type.headline),
              color: colors.text,
              fontVariant: ["tabular-nums"],
            }}
          >
            {value}
            {unitSuffix ? (
              <Text style={{ ...Type.caption, color: colors.textTertiary }}> {unitSuffix}</Text>
            ) : null}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label} row more options`}
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={{ padding: 2 }}
          >
            <Ellipsis size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View
        accessibilityRole="progressbar"
        style={{
          width: "100%",
          height: tone === "water" ? 8 : 6,
          borderRadius: 4,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            height: "100%",
            borderRadius: 4,
            backgroundColor: barColor,
          }}
        />
      </View>

      {secondaryLine ? (
        <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: Spacing.xs }}>
          {secondaryLine}
        </Text>
      ) : null}
      {overTarget ? (
        <Text style={{ fontSize: 10, fontWeight: "700", color: Accent.warningSolid, marginTop: Spacing.xs }}>
          {overCopy}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: Spacing.md,
        }}
      >
        {children}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
          onPress={() => setMenuOpen(false)}
          style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "center", alignItems: "center" }}
        >
          <View
            style={[{
              minWidth: 220,
              backgroundColor: cardElevation.liftBg ?? colors.card,
              borderRadius: Radius.md,
              padding: Spacing.md,
              borderWidth: cardElevation.useBorder ? 1 : 0,
              borderColor: colors.cardBorder,
            }, cardElevation.shadowStyle]}
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
              style={{ paddingVertical: Spacing.dense }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Reset today</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setMenuOpen(false)}
              style={{ paddingVertical: Spacing.dense }}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * Chip — a quick-add pill. SLOE `TD2` frame uses a calm frost-mist fill
 * with a hairline; the tone colour stays on the label so the chip's
 * meaning (water/caffeine/alcohol) is still legible at a glance.
 */
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
  const colors = useThemeColors();
  const accent = useAccent();
  const waterTone = useMacroColors().colors.water; // ENG-1275: alcohol label → accent.alcoholSolid (amber tone was 2.61:1 on backgroundSecondary = AA fail)
  const labelColor = tone === "alcohol" ? accent.alcoholSolid : tones(waterTone)[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={{
        flexGrow: 1,
        flexBasis: "22%",
        alignItems: "center",
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        borderRadius: Radius.full,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: labelColor }}>
        {label}
      </Text>
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

  // Split water value + unit — value in Newsreader, unit in caption (`TD2` frame `0 ml / 1.8 L`).
  const waterValueLine = `${formatWaterLine(waterTotalMl, measurementSystem)} / ${formatWaterLine(targets.waterMl, measurementSystem)}`;

  return (
    <View
      accessibilityLabel="Hydration and stimulants"
      style={[{ gap: Layout.todaySectionCardGap }, style]}
    >
      <SloeCard title="Hydration" testID="today-hydration-card">
        <Row
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
      </SloeCard>

      {showCaffeine || showAlcohol ? (
        <SloeCard title="Stimulants" rightLabel="This week" testID="today-stimulants-card">
          {showCaffeine ? (
            <Row
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
        </SloeCard>
      ) : null}
    </View>
  );
}
