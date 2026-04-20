import * as React from "react";
import { ScrollView, Text, TextStyle, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { Accent, MacroColors, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useOnboardingV2 } from "../context";
import { MobileMethodologyNote } from "../scaffold";

/**
 * Mobile Reveal — animated count-up + macro tiles. Mirrors the web
 * Reveal step. Animation runs on requestAnimationFrame; on mount the
 * value transitions from 0 to the computed target over ~1.2 s.
 */

export function MobileRevealStep() {
  const { targets, state } = useOnboardingV2();
  const colors = useThemeColors();
  const target = targets?.target ?? 0;

  const [displayCals, setDisplayCals] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    if (target === 0) {
      setDisplayCals(0);
      setProgress(0);
      return;
    }
    const start = Date.now();
    const dur = 1200;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplayCals(Math.round(target * e));
      setProgress(e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (targets == null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center" }}>
          Answer the body-stats steps to see your daily targets.
        </Text>
      </View>
    );
  }

  const userPace = targets.pace;
  const kcalAdj = Math.abs(targets.kcalAdj);
  const paceLabel = userPace.toFixed(2);
  const goalBlurb = {
    lose: `At ~${paceLabel} kg/week, this is ~${kcalAdj.toLocaleString()} kcal below your estimated TDEE of ${targets.tdee.toLocaleString()}.`,
    maintain: `This matches your estimated TDEE of ${targets.tdee.toLocaleString()} — no deficit, no surplus.`,
    gain: `A ~${kcalAdj.toLocaleString()} kcal surplus on your estimated TDEE of ${targets.tdee.toLocaleString()} for ~${paceLabel} kg/week gains. Slow builds hold.`,
    recomp: `A ~${kcalAdj.toLocaleString()} kcal deficit with protein anchored to bodyweight. Body composition changes take time.`,
  }[state.goal ?? "maintain"];

  const SIZE = 220;
  const R = 88;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - progress);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 24, alignItems: "center" }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1.3,
            color: Accent.primaryLight,
            marginBottom: 10,
          }}
        >
          Your daily target
        </Text>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: colors.text,
            letterSpacing: -0.4,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Here&apos;s what your day looks like.
        </Text>

        <View
          style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}
        >
          <Svg
            width={SIZE}
            height={SIZE}
            style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
          >
            <Defs>
              <SvgLinearGradient id="reveal-grad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={Accent.primaryLight} />
                <Stop offset="1" stopColor={MacroColors.fat} />
              </SvgLinearGradient>
            </Defs>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={colors.inputBg}
              strokeWidth={12}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke="url(#reveal-grad)"
              strokeWidth={12}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${C} ${C}`}
              strokeDashoffset={dashOffset}
            />
          </Svg>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                fontSize: 56,
                fontWeight: "800",
                letterSpacing: -1.8,
                color: colors.text,
                fontVariant: ["tabular-nums"],
                lineHeight: 56,
                includeFontPadding: false,
              }}
            >
              {displayCals.toLocaleString()}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.textSecondary,
                marginTop: 6,
              }}
            >
              kcal / day
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            textAlign: "center",
            marginTop: 16,
            lineHeight: 19,
            maxWidth: 340,
          }}
        >
          {goalBlurb}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <MacroTile
            name="Protein"
            value={targets.proteinG}
            color={MacroColors.protein}
            pct={Math.round(((targets.proteinG * 4) / targets.target) * 100)}
          />
          <MacroTile
            name="Carbs"
            value={targets.carbsG}
            color={MacroColors.carbs}
            pct={Math.round(((targets.carbsG * 4) / targets.target) * 100)}
          />
          <MacroTile
            name="Fat"
            value={targets.fatG}
            color={MacroColors.fat}
            pct={Math.round(((targets.fatG * 9) / targets.target) * 100)}
          />
        </View>

        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 14,
            padding: 14,
            flexDirection: "row",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={overlineStyle(colors)}>BMR</Text>
            <Text style={summaryNumStyle(colors)}>
              {targets.bmr.toLocaleString()}
              <Text style={summaryUnitStyle(colors)}> kcal</Text>
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={overlineStyle(colors)}>Est. TDEE</Text>
            <Text style={summaryNumStyle(colors)}>
              {targets.tdee.toLocaleString()}
              <Text style={summaryUnitStyle(colors)}> kcal</Text>
            </Text>
          </View>
        </View>

        <MobileMethodologyNote>
          Values are estimates based on the Mifflin-St Jeor equation. Suppr
          will re-calibrate your TDEE from your logged intake and Apple Health
          data over the first ~2 weeks.
        </MobileMethodologyNote>
      </View>
    </ScrollView>
  );
}

function MacroTile({
  name,
  value,
  color,
  pct,
}: {
  name: string;
  value: number;
  color: string;
  pct: number;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: Radius.md + 2,
        padding: 14,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 1,
            color: colors.textTertiary,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            color,
          }}
        >
          {pct}%
        </Text>
      </View>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: -0.5,
          fontVariant: ["tabular-nums"],
          lineHeight: 24,
        }}
      >
        {value}
        <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "500" }}>
          {" "}
          g
        </Text>
      </Text>
      <View
        style={{
          marginTop: 10,
          height: 3,
          borderRadius: 2,
          backgroundColor: color + "22",
        }}
      >
        <View
          style={{
            width: `${Math.min(100, pct)}%`,
            height: "100%",
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function overlineStyle(
  colors: ReturnType<typeof useThemeColors>,
): TextStyle {
  return {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  };
}
function summaryNumStyle(
  colors: ReturnType<typeof useThemeColors>,
): TextStyle {
  return {
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.text,
    letterSpacing: -0.4,
    marginTop: 2,
  };
}
function summaryUnitStyle(
  colors: ReturnType<typeof useThemeColors>,
): TextStyle {
  return {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "500",
  };
}
