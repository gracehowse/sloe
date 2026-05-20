import { useEffect, useRef, useState } from "react";
import { Pressable, Text, useColorScheme, View } from "react-native";
import * as Haptics from "expo-haptics";
import { PostHogMaskView } from "posthog-react-native";
import Svg, { Circle, G } from "react-native-svg";
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

import { Accent, Colors, MacroColors } from "@/constants/theme";
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

// F-60 (2026-04-22): 160 → 140 to address repeat tester complaints
// ("calorie section still massive" / "cals still too big hasn't been
// fixed" on build 28). Macro-ring radii stay proportional.
const SIZE = 140;
const STROKE = 8;
// 2026-05-12 (premium-bar DC1): macro arc stroke 5 → 6.5. Audit flagged
// "macro arcs too thin to read at a glance" — Apple Watch's nested
// rings ship at ~7-8px on a similar diameter. We bump to 6.5 (not 7)
// because MACRO_R[2] = R - 32 = 30, and a 7px stroke at radius 30 has
// the inner edge at 26.5px which starts crowding the centre text.
// 6.5 keeps centre text breathing room while making each arc readable
// as a macro indicator instead of a faint hairline.
const MACRO_STROKE = 6.5;
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
  /** Centre + outer ring: green on track, red over. */
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
          {/* Main calorie ring track — neutral when empty; no brand gradient. */}
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE}
            opacity={isEmpty ? 0.35 : 1}
          />
          {/* Progress: green under budget, red over. Empty = no visible arc. */}
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
        {/* N5 (2026-05-03): empty-state soft copy now fires in BOTH
            display modes (was previously gated to `consumed` only,
            which left the default REMAINING view showing a giant
            ring number that read as a wireframe placeholder before
            the user had logged anything). N3 (2026-05-03): centre
            value renders with `.toLocaleString()` so 4-digit kcal
            ("1,832") matches the budget line below. */}
        {isEmpty ? (
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
                // Grace 2026-05-05: 4-digit values like "1,516" at fontSize 22
                // bold are ~80px wide and overlap the innermost macro ring
                // (diameter ~64). Drop expanded centre to 18 so 4–5 char
                // values fit cleanly inside the inner ring band. Collapsed
                // mode (no macro rings) keeps the original 28 for readability.
                fontSize: expanded ? 18 : 28,
                fontWeight: "700",
                color: ringStateColor,
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
              fontSize: expanded ? 8 : 10,
              fontWeight: "700",
              color: ringStateColor,
              letterSpacing: expanded ? 0 : 0.8,
              marginTop: 1,
            }}
          >
            {centerLabel}
          </Text>
        )}
        {/* Budget line hidden when the concentric macro rings are
            showing — Grace 2026-04-20: text + rings looked squished.
            Also hidden when goal <= 0 (no profile target yet) so the
            ring doesn't render "of 0 kcal" — 2026-05-05 audit R03. */}
        {!expanded && goal > 0 ? (
          // ENG-534 P1 (2026-05-16): budget line shows the user's
          // daily target — same MEDIUM-class as the centre value.
          <PostHogMaskView>
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
