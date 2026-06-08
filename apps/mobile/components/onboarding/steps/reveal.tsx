import * as React from "react";
import { Pressable, ScrollView, Text, TextStyle, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { BookOpen, Scale, Sparkles, Target } from "lucide-react-native";
import { Accent, FontFamily, MacroColors, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { useOnboarding } from "../context";
import { MobileMethodologyNote } from "../scaffold";

/**
 * Mobile Reveal — animated count-up + macro tiles. Mirrors the web
 * Reveal step. Animation runs on requestAnimationFrame; on mount the
 * value transitions from 0 to the computed target over ~1.2 s.
 */

export function MobileRevealStep() {
  const { targets, state } = useOnboarding();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the target-reveal
  // ring gradient, the weight-skipped Scale glyph, and the "Log meals" next-step
  // icon. The "Watch the ring fill" row keeps `Accent.success` (green status),
  // the "Adapt" row keeps `MacroColors.fat`, and the macro tiles keep their own
  // `MacroColors` — none of those are the secondary accent.
  const accent = useAccent();
  const target = targets?.target ?? 0;

  const [displayCals, setDisplayCals] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  // 2026-05-12 (premium-bar audit DC1 — refuse-to-pass #5, Cal AI
  // plan-reveal borrow): the ring + number used to start counting
  // the instant the screen mounted, which read as "the page just
  // loaded a number". Add a ~700ms anticipation beat where the
  // hero stays blank, then snap into the count-up + ring sweep.
  // Mirrors the Cal AI / Strava plan-reveal cadence: pause, then
  // payoff. Haptic fires the moment the count-up begins so the
  // body feels the moment too.
  const [revealStarted, setRevealStarted] = React.useState(false);
  React.useEffect(() => {
    if (target === 0) {
      setDisplayCals(0);
      setProgress(0);
      setRevealStarted(false);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const beatTimer = setTimeout(() => {
      if (cancelled) return;
      setRevealStarted(true);
      // Apple-style success notification on the reveal moment. iOS
      // honours per-device haptic settings; on Android the call is
      // a no-op (we ship iOS-only via TestFlight today anyway).
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* silent — haptics aren't critical to the flow */
      }
      const start = Date.now();
      const dur = 1200;
      const tick = () => {
        if (cancelled) return;
        const p = Math.min(1, (Date.now() - start) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setDisplayCals(Math.round(target * e));
        setProgress(e);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(beatTimer);
      cancelAnimationFrame(raf);
    };
  }, [target]);

  if (targets == null) {
    // 2026-05-14 (premium-bar audit B5 #4): weight-skipped branch is
    // rebuilt as a soft-illustration moment rather than a flat error /
    // fallback. A `Scale` glyph in a brand-tinted circle reassures the
    // user that skipping weight is an explicit, valid path — the plan
    // will still build off their goal, and the precision lift from
    // adding a weight is one tap away from Settings whenever they want
    // it. The fallback when body-stats are entirely missing keeps the
    // calmer copy + same visual treatment so the surface never lands
    // as a stark "no value here" screen.
    const skippedWeight = state.weightSkipped;
    const calibrateCopy = skippedWeight
      ? "We'll use your goal to estimate your targets — you can add your weight later for more precision."
      : "Answer the body-stats steps to see your daily targets.";
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
          gap: 18,
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: `${accent.primary}1A`,
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Scale size={48} color={accent.primaryLight} strokeWidth={1.75} />
        </View>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 14,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: 20,
          }}
        >
          {calibrateCopy}
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
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: 1.3,
            color: colors.textTertiary,
            marginBottom: 10,
          }}
        >
          Your daily target
        </Text>
        {/* 2026-05-12 (premium-bar audit, B5 Reveal upgrade #2):
            re-titled the reveal h1 from "Here's what your day looks
            like." → "Your plan is ready." Cal AI parity — leads with
            completion + reward beat, not "look at this dashboard".
            Sloe reskin (Figma plan-ready 192:2 2026-06-07): plum
            Newsreader serif hero title (`colors.navPrimary` theme-aware
            plum). Mirrors the web reveal hero. */}
        <Text
          style={{
            fontFamily: FontFamily.serifSemibold,
            fontSize: 24,
            fontWeight: "500",
            color: colors.navPrimary,
            letterSpacing: -0.3,
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Your plan is ready.
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
                <Stop offset="0" stopColor={accent.primaryLight} />
                <Stop offset="1" stopColor={accent.primary} />
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
            {/* 2026-05-12 (premium-bar audit DC1 — Cal AI plan-reveal):
                during the ~700ms anticipation beat the centre shows a
                soft "Crunching your numbers" caption instead of a
                static 0 kcal. The moment the count-up + ring sweep
                start, the centre snaps to the big tabular kcal value.
                Reads as deliberate (the engine is doing work) rather
                than empty (the page hasn't loaded). */}
            {revealStarted ? (
              <>
                {/* Sloe reskin — ring calorie numeral in the Newsreader
                    serif display face + plum heading ink, matching the
                    Today ring + Figma 192:2. tabular-nums preserved so
                    the count-up doesn't jitter. */}
                <Text
                  style={{
                    fontFamily: FontFamily.serifRegular,
                    fontSize: 56,
                    fontWeight: "400",
                    letterSpacing: -1.2,
                    color: colors.navPrimary,
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
              </>
            ) : (
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: colors.textSecondary,
                  textAlign: "center",
                  lineHeight: 19,
                  maxWidth: 160,
                }}
              >
                Crunching your numbers…
              </Text>
            )}
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
          Values are estimates based on the Mifflin-St Jeor equation. Sloe
          will re-calibrate your TDEE from your logged intake and activity
          data over the first ~2 weeks.
        </MobileMethodologyNote>

        {/* 2026-05-12 (premium-bar audit B5 Reveal #3, Cal AI parity):
            "Show the maths" expandable that reveals the formula breakdown
            so the abstract numbers above land as something the user can
            audit. Closed by default — power users tap to expand, the
            average user reads the bigger blocks above and moves on. */}
        <RevealShowTheMaths
          colors={colors}
          bmr={targets.bmr}
          tdee={targets.tdee}
          target={targets.target}
          kcalAdj={targets.kcalAdj}
          goal={state.goal ?? "maintain"}
        />

        {/* 2026-05-12 (premium-bar audit DC1 — refuse-to-pass #5, Cal AI
            plan-reveal borrow): "what happens next" 3-step card. Tells
            the user what the very next moments of the app look like
            after they tap Continue. Anchors the abstract number to a
            concrete daily loop. Steps are intentionally bare — no CTAs,
            no expanders — so the eye lands on the path, not the chrome. */}
        <View
          style={{
            marginTop: Spacing.lg,
            padding: Spacing.md,
            borderRadius: Radius.md + 2,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 14,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 1.2,
              color: colors.textTertiary,
            }}
          >
            What happens next
          </Text>
          <NextStepRow
            Icon={BookOpen}
            iconBg={`${accent.primary}1A`}
            iconColor={accent.primary}
            title="Log meals as you eat"
            sub="Search, barcode, photo, voice — whichever's fastest."
          />
          {/* "Watch the ring fill" intentionally uses `Accent.success` (green
              status), NOT the secondary accent — held warm regardless of the
              Frost flag. */}
          <NextStepRow
            Icon={Target}
            iconBg={`${Accent.success}1A`}
            iconColor={Accent.success}
            title="Watch the ring fill"
            sub="Today's hero shows where you are vs your target in one glance."
          />
          <NextStepRow
            Icon={Sparkles}
            iconBg={`${MacroColors.fat}1A`}
            iconColor={MacroColors.fat}
            title="Adapt over the first ~2 weeks"
            sub="As you log + weigh in, Sloe re-tunes your TDEE to what your body actually does."
          />
        </View>
      </View>
    </ScrollView>
  );
}

function NextStepRow({
  Icon,
  iconBg,
  iconColor,
  title,
  sub,
}: {
  Icon: typeof BookOpen;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: iconBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={iconColor} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 }}>
          {sub}
        </Text>
      </View>
    </View>
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
  // 2026-05-13 (premium-bar audit Reveal #4 — pair macro % with g
  // inline): feature-flag-gated layout variant that moves the
  // percentage out of the eyebrow row and pairs it inline with the
  // grams value. Pair flag default OFF; Grace flips the
  // `reveal-macro-tile-paired-pct` flag in PostHog once she's
  // validated the change in TF. Flag name + rollout doc in the
  // commit message; cleanup follow-up in 2 weeks if ramp held 100%.
  const pairedLayout = isFeatureEnabled("reveal-macro-tile-paired-pct");
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
        {!pairedLayout ? (
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
        ) : null}
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
        {pairedLayout ? (
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              color,
            }}
          >
            {` · ${pct}%`}
          </Text>
        ) : null}
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

/**
 * RevealShowTheMaths — 2026-05-12 (premium-bar audit B5 #3, Cal AI
 * plan-reveal parity).
 *
 * A small "Show the maths" expander rendered below the BMR / TDEE
 * tiles. Closed by default. Tap → reveals a 3-row breakdown:
 *   - BMR (Mifflin-St Jeor)
 *   - Est. TDEE (BMR × activity factor)
 *   - Target (TDEE ± deficit/surplus)
 *
 * Power users get the audit trail; the average user reads the big
 * blocks above and skips the expander entirely. Matches the audit's
 * "show the maths" prescription without crowding the default state.
 */
function RevealShowTheMaths({
  colors,
  bmr,
  tdee,
  target,
  kcalAdj,
  goal,
}: {
  colors: ReturnType<typeof useThemeColors>;
  bmr: number;
  tdee: number;
  target: number;
  kcalAdj: number;
  goal: "lose" | "maintain" | "gain" | "recomp";
}) {
  const [open, setOpen] = React.useState(false);
  // Secondary accent (Frost flag → damson, else clay) for the "Show the maths"
  // disclosure link + chevron.
  const accent = useAccent();
  const adjSigned =
    goal === "gain"
      ? `+${kcalAdj.toLocaleString()}`
      : goal === "maintain"
        ? "±0"
        : `−${Math.abs(kcalAdj).toLocaleString()}`;

  const rows: { label: string; value: string; sub: string }[] = [
    {
      label: "BMR",
      value: `${bmr.toLocaleString()} kcal`,
      sub: "Mifflin-St Jeor (sex · age · height · weight)",
    },
    {
      label: "Est. TDEE",
      value: `${tdee.toLocaleString()} kcal`,
      sub: "BMR × your activity level",
    },
    {
      label: "Target",
      value: `${target.toLocaleString()} kcal`,
      sub: `Est. TDEE ${adjSigned} kcal for your goal`,
    },
  ];

  return (
    <View style={{ marginTop: Spacing.md }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide the maths" : "Show the maths"}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 8,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: accent.primary,
            letterSpacing: 0.1,
          }}
        >
          {open ? "Hide the maths" : "Show the maths"}
        </Text>
        {open ? (
          <ChevronUp size={14} color={accent.primary} strokeWidth={2.25} />
        ) : (
          <ChevronDown size={14} color={accent.primary} strokeWidth={2.25} />
        )}
      </Pressable>
      {open ? (
        <View
          style={{
            marginTop: 6,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: Spacing.md,
            gap: 12,
          }}
          accessibilityRole="text"
        >
          {rows.map((row) => (
            <View key={row.label}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.textSecondary,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {row.label}
                </Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: colors.text,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {row.value}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: 2,
                  lineHeight: 16,
                }}
              >
                {row.sub}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
