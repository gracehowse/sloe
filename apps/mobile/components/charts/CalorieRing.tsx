import { useEffect, useRef, useState } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import * as Haptics from "expo-haptics";
import { PostHogMaskView } from "posthog-react-native";
import Svg, { Circle, G, Defs, Pattern, Line } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  PREMIUM_MOTION_RING_MS,
  PREMIUM_MOTION_V1_FLAG,
  PREMIUM_MOTION_COUNT_MS,
} from "@suppr/shared/preferences/premiumMotion";

import { Accent, Colors, MacroColors, Type } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { RING_LABELS } from "@suppr/shared/copy/today";

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
  options?: {
    snapOn?: unknown;
    duration?: number;
    reduceMotion?: boolean;
    /** ENG-603: count up from 0 on first paint when flag is on. */
    animateFromZeroOnMount?: boolean;
  },
): number {
  const duration = options?.duration ?? 400;
  const snapOn = options?.snapOn;
  const reduceMotion = options?.reduceMotion ?? false;
  const animateFromZeroOnMount = options?.animateFromZeroOnMount ?? false;
  const [value, setValue] = useState(animateFromZeroOnMount ? 0 : target);
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

// TF49 ring diameter (140). Hero box padding is separate from ring size.
const SIZE = 140;
const STROKE = 8;
// 2026-05-22 (multi-ring revival A1): inner macro arc stroke = 6 (was 6.5).
// HTML prototype A1 trim to keep the centre kcal value as the focal point
// while preserving the multi-ring identity that MFP-defectors expect. The
// 6.5 → 6 step is small but the diff at three concentric arcs is
// perceptible; calmer hero, macros still readable.
const MACRO_STROKE = 6;
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
  /** Called when user long-presses to toggle display mode. Ignored
   *  when `onLongPressExplain` is also provided — the new explainer
   *  binding takes precedence per 2026-05-12 audit. */
  onToggleDisplayMode?: () => void;
  /** 2026-05-12 (premium-bar DC1, Grace approval): when provided, the
   *  long-press gesture opens the "Why this number?" explainer
   *  instead of toggling display mode. The visible "Why this number?"
   *  pill below the ring is dropped — "the link signals low
   *  confidence; long-press signals depth" per audit. Discoverability
   *  is the trade — Apple Watch / Fitbit / Strava all hide depth
   *  behind a long-press once. */
  onLongPressExplain?: () => void;
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
  const prevPctRef = useRef(pct);

  useEffect(() => {
    const prevPct = prevPctRef.current;
    prevPctRef.current = pct;
    if (prevPct === 0 && pct > 0) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withTiming(Math.min(pct, 0.999), {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      progress.value = withTiming(Math.min(pct, 0.999), {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  // 2026-05-14 — Grace's call: macro arcs always render in their own
  // colour at full opacity, even when the user is over-budget. The
  // previous amber-warm-tint treatment (`dim=true` shifted arc to
  // Accent.warning at 0.6 opacity) collapsed the multi-colour
  // language into a single warning hue and made the ring read as
  // dimmer overall. The destructive outer kcal ring already carries
  // the over-budget signal — the inner arcs don't need to repeat it.
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
  onLongPressExplain,
}: Props) {
  const diff = Math.round(goal - consumed);
  const isOver = consumed > goal;
  // Premium-feel papercut #2 (audit 2026-04-29): the empty-state ring
  // dominates Today's first impression — a giant `0` and "LOGGED"
  // label scream "you've done nothing today" before the user has had
  // a chance to. Soft-mode the centre when consumed is exactly 0 so
  // the suggestion card + macro tiles can lead the visual hierarchy
  // instead. Once the user logs anything, normal treatment resumes.
  // 2026-05-05 (audit R03) — also treat `goal <= 0` as empty (no
  // profile target yet). Without this guard, mobile renders gradient
  // stroke ("calibrating") while web renders destructive red over for
  // the same input — cross-platform contradiction. Both platforms now
  // fall into the calibrating-empty state until a profile target is
  // set.
  const isEmpty = consumed === 0 || goal <= 0;
  const colorScheme = useColorScheme();
  const palette = colorScheme === "dark" ? Colors.dark : Colors.light;
  /** Centre + outer ring colour. 2026-05-22 evening lock (Grace call):
   *  own the green-under / red-over treatment — no toggle, no brand
   *  mode. The earlier `Accent.warning` (orange) treatment was the
   *  bonus colour, so going over read as "all bonus" instead of "you
   *  went past." Red on the over arc makes the state unambiguous and
   *  keeps a different colour from the bonus segment. */
  const ringStateColor = isOver ? Accent.destructive : Accent.success;
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
  const reduceMotion = useReduceMotion();
  const premiumMotion = isFeatureEnabled(PREMIUM_MOTION_V1_FLAG);

  // Tween from the current ring position to the new pct (do NOT snap to
  // zero first). Reanimated 3 continues the existing animation when
  // withTiming is called on an already-animating shared value.
  useEffect(() => {
    if (premiumMotion && !reduceMotion) {
      progress.value = withSpring(pct, { damping: 22, stiffness: 120 });
      return;
    }
    progress.value = withTiming(pct, {
      duration: PREMIUM_MOTION_RING_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, premiumMotion, reduceMotion, progress]);

  // Light haptic feedback when logged calories change — Withings-style
  // confirmation that a new data point has landed. Skipped on mount
  // (prevConsumedRef seeds to the initial value).
  const prevConsumedRef = useRef(consumed);
  useEffect(() => {
    if (consumed !== prevConsumedRef.current && consumed > 0) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    prevConsumedRef.current = consumed;
  }, [consumed]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: mainCirc * (1 - progress.value),
  }));

  // Tween the displayed center value over the same 800ms / cubic-out
  // curve as the ring sweep — number and arc finish together. Snaps
  // (no tween) on display-mode toggle so a long-press doesn't read as
  // a slow countdown across two different metrics. Honours system
  // reduce-motion via `useReduceMotion()`.
  const animatedCenterValue = useAnimatedNumber(centerValue, {
    snapOn: displayMode,
    reduceMotion,
    duration: premiumMotion ? PREMIUM_MOTION_COUNT_MS : 400,
    animateFromZeroOnMount: premiumMotion && !reduceMotion,
  });

  return (
    <Pressable
      onPress={onToggle}
      // 2026-05-12 (Grace TF feedback round 2): revert long-press to the
      // canonical displayMode toggle. The earlier patch wired
      // `onLongPressExplain` here so long-press would open the
      // "Why this number?" sheet, but the trade — losing the
      // expand/displayMode lock-step gesture — was the wrong call.
      // The explainer now lives on a subtle inline affordance below
      // the ring (see TodayHeroRing). Long-press stays the power-user
      // shortcut for ring state.
      onLongPress={onToggleDisplayMode}
      style={{ alignItems: "center" }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          {/* MFP-style diagonal hash pattern. Layered over the red over-
              budget arc to mark the portion past goal. Hue matches
              Accent.destructive so the pattern reads as part of the red
              arc, not a separate colour layer. Grace 2026-05-22:
              "mfp used to make it a hashed colour like this". */}
          <Defs>
            <Pattern
              id="overHash"
              patternUnits="userSpaceOnUse"
              width={6}
              height={6}
              patternTransform="rotate(45)"
            >
              <Line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke={Accent.destructive}
                strokeWidth={3}
              />
            </Pattern>
          </Defs>
          {/* Outer calorie ring track — neutral when empty. */}
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE}
            opacity={isEmpty ? 0.55 : 1}
          />
          {/* Bonus calorie segment (orange). Canonical 2026-05-22 v4
              multi-ring revival: when exercise has bumped the daily
              goal above the base target, render the "earned" territory
              as an orange arc at the end of the ring. This restores
              the MFP visual language MFP-defectors specifically asked
              for ("I want to see my burn in the ring"). Renders behind
              the food fill so consumed calories overlap correctly when
              the user eats into the bonus territory. */}
          {!isEmpty && baseGoal && baseGoal < goal && goal > 0 ? (
            (() => {
              const bonusFraction = (goal - baseGoal) / goal;
              const bonusLen = mainCirc * bonusFraction;
              return (
                <Circle
                  cx={CX}
                  cy={CX}
                  r={R}
                  fill="none"
                  // Canonical 2026-05-22 — bonus uses Accent.warning
                  // (amber #e8a020) to match the activity/burn card +
                  // burn-detail screen which already use the same token
                  // for "earned via exercise" semantics. Grace 2026-05-22:
                  // "bonus on ring is not matching activity on the top
                  // of the page".
                  stroke={Accent.warning}
                  strokeWidth={STROKE}
                  strokeDasharray={`${bonusLen} ${mainCirc}`}
                  strokeDashoffset={-(mainCirc - bonusLen)}
                  rotation="-90"
                  origin={`${CX},${CX}`}
                />
              );
            })()
          ) : null}
          {/* Food progress: green under budget, warning amber over.
              Empty = no visible arc. Renders ON TOP of the bonus
              segment so the green arc visibly "eats into" the orange
              when consumption exceeds the base goal. */}
          <AnimatedCircle
            cx={CX}
            cy={CX}
            r={R}
            stroke={
              isEmpty
                ? trackColor
                : ringStateColor
            }
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${mainCirc}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${CX},${CX}`}
          />
          {/* Hashed overage segment — only renders when consumed > goal.
              Sits ON TOP of the solid red food arc, starting at 12
              o'clock and going clockwise for `(over / goal) * mainCirc`.
              Capped at one full lap so going 2x over doesn't render a
              full lap twice (the centre digit carries the magnitude). */}
          {!isEmpty && isOver && goal > 0 ? (
            (() => {
              const overFraction = Math.min((consumed - goal) / goal, 1);
              const overLen = mainCirc * overFraction;
              return (
                <Circle
                  cx={CX}
                  cy={CX}
                  r={R}
                  fill="none"
                  stroke="url(#overHash)"
                  strokeWidth={STROKE}
                  strokeDasharray={`${overLen} ${mainCirc}`}
                  strokeDashoffset={0}
                  strokeLinecap="butt"
                  rotation="-90"
                  origin={`${CX},${CX}`}
                />
              );
            })()
          ) : null}
          {/* Inner macro arcs — Canonical 2026-05-22 v4 multi-ring revival.
              Restored after the brief C1 single-ring experiment. Each
              macro gets its own concentric arc inside the calorie ring,
              following the TF49 multi-ring grammar that MFP-defectors
              are familiar with. Stroke trimmed 6.5 → 6 (variant A1) so
              the centre kcal value remains the clear focal point.
              Hidden in empty state — three nested grey tracks read as
              wireframe placeholder, not an intentional "ready" state. */}
          {!isEmpty && expanded ? (
            <>
              <MacroRing
                radius={MACRO_R[0]}
                pct={proteinPct}
                color={MacroColors.protein}
                trackColor={trackColor}
                delay={100}
              />
              <MacroRing
                radius={MACRO_R[1]}
                pct={carbsPct}
                color={MacroColors.carbs}
                trackColor={trackColor}
                delay={200}
              />
              <MacroRing
                radius={MACRO_R[2]}
                pct={fatPct}
                color={MacroColors.fat}
                trackColor={trackColor}
                delay={300}
              />
            </>
          ) : null}
        </Svg>
        {/* Center text — number tweens to `centerValue` via
            `useAnimatedNumber`. The displayed integer counts up
            smoothly when the user logs a meal, finishing with the
            ring sweep (~800ms cubic out). Snaps on displayMode
            toggle. Empty state (audit 2026-04-29 papercut #2)
            replaces the giant "0" with a softer "Start your day"
            invitation so the empty ring stops dominating the screen. */}
        {/* N5 (2026-05-03): empty-state soft copy now fires in BOTH
            display modes (was previously gated to `consumed` only,
            which left the default REMAINING view showing a giant
            ring number that read as a wireframe placeholder before
            the user had logged anything). N3 (2026-05-03): centre
            value renders with `.toLocaleString()` so 4-digit kcal
            ("1,832") matches the budget line below. */}
        {isEmpty ? (
          // 2026-05-23 (Grace clarification): empty-state ring keeps
          // "Start your day" + "{goal} kcal goal" — what we needed to
          // remove was the THIRD line ("of {goal} kcal" from the
          // budgetLine block below), which was the same number twice.
          // The budgetLine is now suppressed when `isEmpty` so the ring
          // shows the invitation + goal exactly once.
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text
              style={{
                ...Type.headline,
                color: textColor,
                textAlign: "center",
              }}
            >
              Start your day
            </Text>
            {goal > 0 ? (
              <Text
                style={{
                  ...Type.caption,
                  color: secondaryColor,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {Math.round(goal).toLocaleString()} kcal goal
              </Text>
            ) : null}
          </View>
        ) : (
          // ENG-534 P1 (2026-05-16): centre kcal value is MEDIUM-class
          // (running daily total — high frequency in replays, valuable
          // signal at aggregate). Wrap in PostHogMaskView so replay
          // renders the number as a grey block. The empty-state copy
          // above is intentionally NOT masked — "Start your day" is
          // generic UI copy. See
          // `docs/operations/session-replay-masking-audit.md`.
          <PostHogMaskView>
            <Text
              style={{
                ...Type.macroValue,
                color: textColor,
                fontVariant: ["tabular-nums"],
              }}
            >
              {animatedCenterValue.toLocaleString()}
            </Text>
          </PostHogMaskView>
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
        {!isEmpty && (
          <Text
            style={{
              ...Type.label,
              color: textColor,
              marginTop: 1,
            }}
          >
            {centerLabel}
          </Text>
        )}
        {/* Budget line shows under the centre label only when collapsed.
            Multi-ring revival 2026-05-22 v4: when expanded, the budget
            line conflicts visually with the innermost macro arc; the
            stats row below the ring (Goal / Food / Exercise) carries
            the explicit numbers in that case. */}
        {goal > 0 && !expanded && !isEmpty ? (
          <PostHogMaskView>
            <Text
              style={{
                ...Type.caption,
                color: secondaryColor,
                marginTop: 1,
                fontVariant: ["tabular-nums"],
              }}
            >
              {budgetLine}
            </Text>
          </PostHogMaskView>
        ) : null}
      </View>
      {/* 2026-05-14 — Grace's call: removed the
          fraction + delta chip row below the ring. The hero kcal
          inside the ring already shows the running total, and
          long-press on the ring surfaces the over/remaining detail
          — duplicating it as a static line under the ring was
          redundant. */}
    </Pressable>
  );
}
