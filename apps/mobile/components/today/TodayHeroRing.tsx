import React from "react";
import { Text, View } from "react-native";
import CalorieRing from "@/components/charts/CalorieRing";
import { MacroColors, Radius, Spacing } from "@/constants/theme";

/**
 * TodayHeroRing — ring hero variant.
 *
 * Originally extracted from `apps/mobile/app/(tabs)/index.tsx`
 * (audit H3, 2026-04-18) as a thin wrapper over `CalorieRing`. Ported
 * to match the 2026-04-19 Claude Design prototype
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
 *  → `HeroRing`) on 2026-04-20:
 *   - Now rendered inside a bordered card so the ring has visual weight
 *     matching the bar/number variants (prototype treats all three as
 *     peer "hero cards").
 *   - When NOT expanded, a mini-stats row shows logged / burned / net.
 *   - When expanded, per-macro gram rows appear below the ring,
 *     mirroring the kcal displayMode — i.e. remaining grams per macro
 *     in `remaining` mode, logged grams in `consumed` mode.
 *   - Helper text clarifies both gestures: "Tap for macros · hold to
 *     switch to remaining/logged".
 */
export interface TodayHeroRingProps {
  consumed: number;
  goal: number;
  baseGoal: number | undefined;
  burned?: number | null;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  cardBackgroundColor: string;
  borderColor: string;

  // Macro progress (0..1) for the inner rings when expanded
  proteinPct: number;
  carbsPct: number;
  fatPct: number;

  // Macro gram values — used for the expanded-state macro rows
  loggedProtein: number;
  targetProtein: number;
  loggedCarbs: number;
  targetCarbs: number;
  loggedFat: number;
  targetFat: number;
  loggedFiber: number;
  targetFiber: number;

  // Interaction — host-owned
  expanded: boolean;
  onToggleExpanded: () => void;
  displayMode: "remaining" | "consumed";
  onToggleDisplayMode: () => void;
  textTertiaryColor: string;
}

export function TodayHeroRing({
  consumed,
  goal,
  baseGoal,
  burned,
  textColor,
  secondaryColor,
  trackColor,
  cardBackgroundColor,
  borderColor,
  proteinPct,
  carbsPct,
  fatPct,
  loggedProtein,
  targetProtein,
  loggedCarbs,
  targetCarbs,
  loggedFat,
  targetFat,
  loggedFiber,
  targetFiber,
  expanded,
  onToggleExpanded,
  displayMode,
  onToggleDisplayMode,
  textTertiaryColor,
}: TodayHeroRingProps) {
  const net = consumed - (burned ?? 0);
  const netSign = net > 0 ? "+" : "";

  return (
    <View
      style={{
        backgroundColor: cardBackgroundColor,
        borderWidth: 1,
        borderColor: borderColor,
        borderRadius: Radius.lg,
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.lg,
        alignItems: "center",
        gap: Spacing.md,
      }}
    >
      <CalorieRing
        consumed={consumed}
        goal={goal}
        baseGoal={baseGoal}
        textColor={textColor}
        secondaryColor={secondaryColor}
        trackColor={trackColor}
        proteinPct={proteinPct}
        carbsPct={carbsPct}
        fatPct={fatPct}
        expanded={expanded}
        onToggle={onToggleExpanded}
        displayMode={displayMode}
        onToggleDisplayMode={onToggleDisplayMode}
      />

      {expanded ? (
        <View
          style={{
            width: "100%",
            gap: Spacing.sm,
            paddingHorizontal: Spacing.xs,
            paddingTop: Spacing.xs,
          }}
        >
          <MacroRow
            label="Protein"
            logged={loggedProtein}
            target={targetProtein}
            color={MacroColors.protein}
            displayMode={displayMode}
            textColor={textColor}
            secondaryColor={secondaryColor}
            textTertiaryColor={textTertiaryColor}
          />
          <MacroRow
            label="Carbs"
            logged={loggedCarbs}
            target={targetCarbs}
            color={MacroColors.carbs}
            displayMode={displayMode}
            textColor={textColor}
            secondaryColor={secondaryColor}
            textTertiaryColor={textTertiaryColor}
          />
          <MacroRow
            label="Fat"
            logged={loggedFat}
            target={targetFat}
            color={MacroColors.fat}
            displayMode={displayMode}
            textColor={textColor}
            secondaryColor={secondaryColor}
            textTertiaryColor={textTertiaryColor}
          />
          <MacroRow
            label="Fiber"
            logged={loggedFiber}
            target={targetFiber}
            color={MacroColors.fiber}
            displayMode={displayMode}
            textColor={textColor}
            secondaryColor={secondaryColor}
            textTertiaryColor={textTertiaryColor}
          />
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: Spacing.xxl, marginTop: Spacing.xs }}>
          <MiniStat value={consumed.toLocaleString()} label="logged" textColor={textColor} textTertiaryColor={textTertiaryColor} />
          <MiniStat value={(burned ?? 0).toLocaleString()} label="burned" textColor={textColor} textTertiaryColor={textTertiaryColor} />
          <MiniStat value={`${netSign}${net.toLocaleString()}`} label="net" textColor={textColor} textTertiaryColor={textTertiaryColor} />
        </View>
      )}

      <Text style={{ fontSize: 10, color: textTertiaryColor, textAlign: "center" }}>
        Tap for macros · hold to switch to {displayMode === "remaining" ? "logged" : "remaining"}
      </Text>
    </View>
  );
}

function MacroRow({
  label,
  logged,
  target,
  color,
  displayMode,
  textColor,
  secondaryColor,
  textTertiaryColor,
}: {
  label: string;
  logged: number;
  target: number;
  color: string;
  displayMode: "remaining" | "consumed";
  textColor: string;
  secondaryColor: string;
  textTertiaryColor: string;
}) {
  const shown = displayMode === "remaining" ? Math.max(0, target - logged) : logged;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ flex: 1, fontSize: 12, color: secondaryColor }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: textColor, fontVariant: ["tabular-nums"] }}>
        {shown}
        <Text style={{ color: textTertiaryColor, fontSize: 11, fontWeight: "500" }}> g</Text>
      </Text>
    </View>
  );
}

function MiniStat({
  value,
  label,
  textColor,
  textTertiaryColor,
}: {
  value: string;
  label: string;
  textColor: string;
  textTertiaryColor: string;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: textColor, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          color: textTertiaryColor,
          letterSpacing: 1.1,
          textTransform: "uppercase",
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default TodayHeroRing;
