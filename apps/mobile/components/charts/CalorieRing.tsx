import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

import { Accent, MacroColors } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { RING_LABELS } from "../../../../src/lib/copy/today";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Tween a displayed integer from its previous value to `target` over
 * `duration` ms with cubic-out easing — matches the ring sweep that
 * already animates over the same duration so the number and the
 * progress arc finish together.
 *
 * `snapOn` is a discriminator: when its value changes, the displayed
 * number snaps to `target` instantly instead of tweening. Use it to
 * suppress the count animation on a mode toggle (e.g. long-press
 * switches displayMode from "remaining" to "consumed" — counting the
 * value across modes would be confusing). Pass `displayMode` as
 * `snapOn`.
 *
 * The first render seeds the displayed value to `target`, so there is
 * no count-up animation on mount; only later changes tween.
 *
 * Why a plain RAF loop and not Reanimated `useSharedValue` +
 * `useAnimatedProps`: the RN-Reanimated pattern for animated text is
 * `Animated.createAnimatedComponent(TextInput)` with the `text` prop
 * driven from a worklet, which works but introduces a TextInput where
 * a Text is wanted (different layout / line-height defaults, harder
 * to style consistently). A 60-fps RAF loop with React state on a
 * single Text node is cheap (one node, one re-render per frame for
 * ~800ms), and sidesteps the TextInput swap. If perf becomes an
 * issue on lower-end devices, switch to the Reanimated path.
 */
function useAnimatedNumber(
  target: number,
  options?: { snapOn?: unknown; duration?: number; reduceMotion?: boolean },
): number {
  const duration = options?.duration ?? 800;
  const snapOn = options?.snapOn;
  const reduceMotion = options?.reduceMotion ?? false;
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);
  const lastSnapRef = useRef(snapOn);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    // Mode toggle (or any explicit "snap" trigger) — jump straight to
    // the new value without tweening.
    if (snapOn !== lastSnapRef.current) {
      lastSnapRef.current = snapOn;
      setValue(target);
      return;
    }
    if (valueRef.current === target) return;
    // Reduced-motion: snap, no count-up loop.
    if (reduceMotion) {
      setValue(target);
      return;
    }
    const from = valueRef.current;
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // cubic out — matches ring sweep
      const next = Math.round(from + (target - from) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, snapOn, reduceMotion]);

  return value;
}

// F-60 (2026-04-22): 160 → 140 to address repeat tester complaints
// ("calorie section still massive" / "cals still too big hasn't been
// fixed" on build 28). Macro-ring radii stay proportional.
const SIZE = 140;
const STROKE = 8;
const MACRO_STROKE = 5;
const CX = SIZE / 2;
const R = (SIZE - STROKE) / 2 - 2;
const MACRO_R = [R - 12, R - 22, R - 32];
const CIRC = (r: number) => 2 * Math.PI * r;

type DisplayMode = "remaining" | "consumed";

type Props = {
  consumed: number;
  goal: number;
  /** The base goal before activity bonus (used to show bonus segment in a different colour) */
  baseGoal?: number;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  /** Macro progress values 0-1 */
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  /** Whether expanded state showing macro rings */
  expanded?: boolean;
  /** Toggle expanded */
  onToggle?: () => void;
  /** Show remaining or consumed calories */
  displayMode?: DisplayMode;
  /** Called when user long-presses to toggle display mode */
  onToggleDisplayMode?: () => void;
};

function MacroRing({
  radius,
  pct,
  color,
  trackColor,
  delay,
}: {
  radius: number;
  pct: number;
  color: string;
  trackColor: string;
  delay: number;
}) {
  const circ = CIRC(radius);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(Math.min(pct, 0.999), {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  return (
    <G>
      <Circle
        cx={CX}
        cy={CX}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={MACRO_STROKE}
        opacity={0.4}
      />
      <AnimatedCircle
        cx={CX}
        cy={CX}
        r={radius}
        stroke={color}
        strokeWidth={MACRO_STROKE}
        fill="none"
        strokeDasharray={`${circ}`}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${CX},${CX}`}
      />
    </G>
  );
}

export default function CalorieRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  proteinPct = 0,
  carbsPct = 0,
  fatPct = 0,
  expanded = true,
  onToggle,
  displayMode = "consumed",
  onToggleDisplayMode,
}: Props) {
  const diff = Math.round(goal - consumed);
  const isOver = consumed > goal;
  // Premium-feel papercut #2 (audit 2026-04-29): the empty-state ring
  // dominates Today's first impression — a giant `0` and "LOGGED"
  // label scream "you've done nothing today" before the user has had
  // a chance to. Soft-mode the centre when consumed is exactly 0 so
  // the suggestion card + macro tiles can lead the visual hierarchy
  // instead. Once the user logs anything, normal treatment resumes.
  const isEmpty = consumed === 0;
  const centerValue = displayMode === "consumed"
    ? Math.round(consumed)
    : Math.abs(diff);
  const centerLabel = displayMode === "consumed"
    ? RING_LABELS.logged
    : isOver
      ? RING_LABELS.over
      : RING_LABELS.remaining;
  const budgetLine = `of ${Math.round(goal)} kcal`;
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;
  const mainCirc = CIRC(R);

  const progress = useSharedValue(0);

  // Tween from the current ring position to the new pct (do NOT snap to
  // zero first — that produced a jarring "drain then refill" on every
  // log because the prior snapshot was discarded). Reanimated 3
  // continues the existing animation when withTiming is called on an
  // already-animating shared value, which is the desired behaviour for
  // a ring that updates as the user logs through the day.
  useEffect(() => {
    progress.value = withTiming(pct, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: mainCirc * (1 - progress.value),
  }));

  // Tween the displayed center value over the same 800ms / cubic-out
  // curve as the ring sweep — number and arc finish together. Snaps
  // (no tween) on display-mode toggle so a long-press doesn't read as
  // a slow countdown across two different metrics. Honours system
  // reduce-motion via `useReduceMotion()`.
  const reduceMotion = useReduceMotion();
  const animatedCenterValue = useAnimatedNumber(centerValue, {
    snapOn: displayMode,
    reduceMotion,
  });

  return (
    <Pressable onPress={onToggle} onLongPress={onToggleDisplayMode} style={{ alignItems: "center" }}>
      <View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          {/* Brand gradient — same indigo→pink stops as the
              onboarding reveal ring (`steps/reveal.tsx`). Audit
              2026-04-30 ui-critic flagged that the solid green ring
              was reading as functional ("you hit your target") rather
              than aesthetic, while the onboarding reveal at step 12
              uses the brand gradient that's the design ceiling. Pulling
              the same gradient into the daily ring closes the
              visual-language gap between first-time delight and daily
              use. Over-budget keeps the destructive solid red so the
              "you went over" signal stays unambiguous. */}
          <Defs>
            <SvgLinearGradient
              id="calorie-ring-gradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <Stop offset="0" stopColor={Accent.primaryLight} />
              <Stop offset="1" stopColor={MacroColors.fat} />
            </SvgLinearGradient>
          </Defs>
          {/* Main calorie ring track */}
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE}
          />
          {/* Main calorie ring progress */}
          <AnimatedCircle
            cx={CX}
            cy={CX}
            r={R}
            stroke={isOver ? Accent.destructive : "url(#calorie-ring-gradient)"}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${mainCirc}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${CX},${CX}`}
          />
          {/* Macro rings (shown when expanded AND not empty).
              Empty + expanded previously rendered three nested grey
              tracks plus the unfilled calorie ring — four concentric
              empty rings that read as a wireframe placeholder rather
              than an intentional "ready to start" state. Audit
              2026-04-30 ui-critic flagged this as the single biggest
              first-impression gap vs Cal AI / Lifesum / MFP. Hiding
              the macro rings in the empty state collapses the visual
              to one clean track + the soft "Start your day" copy. */}
          {expanded && !isEmpty && (
            <MacroRing
              radius={MACRO_R[0]}
              pct={proteinPct}
              color={MacroColors.protein}
              trackColor={trackColor}
              delay={80}

            />
          )}
          {expanded && !isEmpty && (
            <MacroRing
              radius={MACRO_R[1]}
              pct={carbsPct}
              color={MacroColors.carbs}
              trackColor={trackColor}
              delay={160}

            />
          )}
          {expanded && !isEmpty && (
            <MacroRing
              radius={MACRO_R[2]}
              pct={fatPct}
              color={MacroColors.fat}
              trackColor={trackColor}
              delay={240}
  
            />
          )}
        </Svg>
        {/* Center text — number tweens to `centerValue` via
            `useAnimatedNumber`. The displayed integer counts up
            smoothly when the user logs a meal, finishing with the
            ring sweep (~800ms cubic out). Snaps on displayMode
            toggle. Empty state (audit 2026-04-29 papercut #2)
            replaces the giant "0" with a softer "Start your day"
            invitation so the empty ring stops dominating the screen. */}
        {isEmpty && displayMode === "consumed" ? (
          <Text
            style={{
              fontSize: expanded ? 14 : 16,
              fontWeight: "500",
              color: secondaryColor,
              textAlign: "center",
            }}
          >
            Start your day
          </Text>
        ) : (
          <Text
            style={{
              fontSize: expanded ? 22 : 28,
              fontWeight: "700",
              color: isOver && displayMode !== "consumed" ? Accent.destructive : textColor,
              fontVariant: ["tabular-nums"],
            }}
          >
            {animatedCenterValue}
          </Text>
        )}
        {/* Center label ("REMAINING" / "LOGGED" / "OVER"). Grace
            2026-04-28: the 10pt size + letterSpacing 0.8 ran ~54px
            wide, which clipped the inner-most macro ring (r=32) at
            the label's y position. Solution: shrink + tighten when
            expanded so the text fits cleanly inside the inner-most
            ring band. At fontSize 8 with no extra tracking the word
            "REMAINING" is ~38px wide → ±19 from CX, well inside the
            inner ring's ~±27 band at y. Collapsed mode keeps the
            original 10pt + tracking for readability.
            Hidden in empty state — the "Start your day" copy above
            already invites action; LOGGED beneath would be redundant. */}
        {!(isEmpty && displayMode === "consumed") && (
          <Text
            style={{
              fontSize: expanded ? 8 : 10,
              fontWeight: "700",
              color: isOver && displayMode !== "consumed" ? Accent.destructive : secondaryColor,
              letterSpacing: expanded ? 0 : 0.8,
              marginTop: 1,
            }}
          >
            {centerLabel}
          </Text>
        )}
        {/* Budget line hidden when the concentric macro rings are
            showing — Grace 2026-04-20: text + rings looked squished. */}
        {!expanded ? (
          <Text
            style={{
              fontSize: 10,
              color: secondaryColor,
              marginTop: 1,
              fontVariant: ["tabular-nums"],
            }}
          >
            {budgetLine}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
