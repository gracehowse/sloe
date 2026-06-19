/**
 * WinMomentPlayer — landmark-celebration primitive (mobile).
 *
 * The single component that renders the reserved win-moment for the three
 * landmark celebrations in the product:
 *   - `goal-hit`     — calorie ring closed at/under target for the day
 *   - `streak`       — a logging-streak milestone was reached
 *   - `log-confirm`  — a quiet, one-shot confirm flourish on commit
 *
 * ## Code celebration (Design Direction 2026, 2026-06-01)
 *
 * The goal-hit moment is the shared delight peak — "calm everywhere, electric
 * at the wins." Earlier this primitive mounted a 1-frame TRANSPARENT Lottie
 * placeholder (a no-op), so the payoff rendered blank. It now plays a REAL,
 * code-driven celebration built on Reanimated + `react-native-svg` (both
 * already deps) — NO Lottie art file required (the bespoke `.lottie` asset is
 * ENG-798; this ships the moment now):
 *
 *   1. A gold-gradient ring SWEEPS to completion (the calorie ring "closing"),
 *   2. a gold radial PULSE blooms behind it and fades,
 *   3. the hero number ODOMETERS up to 100% and settles, and
 *   4. subtle gold CONFETTI bursts outward.
 *
 * The whole thing runs ~700ms and then fires `onComplete` so the caller can
 * unmount it. The gold is the dedicated win token (`Accent.win` +
 * `AccentWinGradient`) — the three-role colour law keeps it landmark-only.
 *
 * ## Gating contract (unchanged)
 *
 *   - **Caller owns the gate.** This primitive has zero visual footprint until
 *     mounted; it does NOT read `redesign_winmoment` itself. Callers gate the
 *     mount behind `isFeatureEnabled('redesign_winmoment')` + the once-per-day
 *     / once-per-milestone logic (see `use-win-moment`). The success HAPTIC is
 *     fired by that hook on the same beat as this mount, not here.
 *   - **Plays once.** On mount it runs the celebration a single time (no loop)
 *     and calls `onComplete` when it finishes.
 *   - **Reduce-motion.** When the system reduce-motion flag is on, the player
 *     skips the sweep/pulse/confetti and shows a brief static gold ring + a
 *     "100%" badge, then completes on the same ~700ms beat.
 *
 * Web mirror at `src/app/components/ui/win-moment-player.tsx`. Same prop
 * signature so callers read identically across platforms; the web mirror ships
 * its own code celebration (CSS/SVG) under the same contract.
 */
import * as React from "react";
import { Text, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Accent, Type } from "@/constants/theme";
import { useWinGradient } from "@/context/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import {
  STREAK_WIN_SUBHEAD,
  showStreakMilestoneDisplay,
} from "@suppr/nutrition-core/winMomentStreakCopy";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type WinMomentCelebration = "goal-hit" | "streak" | "log-confirm";

export interface WinMomentPlayerProps {
  /** Which landmark celebration to play. Drives the celebration copy/visual. */
  celebration: WinMomentCelebration;
  /** ENG-901 M5 — streak milestone numeral (3/7/30/100). */
  milestone?: number;
  /** Fired once the (single, non-looping) celebration finishes. Use this to
   *  unmount the player. */
  onComplete?: () => void;
  /** Square render size in px. Default 220. */
  size?: number;
  /** Absolute-fill the player over its parent (full-bleed overlay).
   *  Default false — renders inline at `size`. */
  fullBleed?: boolean;
  /** Test id forwarded to the wrapper view. */
  testID?: string;
}

/** Total celebration duration. The caller's overlay stays mounted for exactly
 *  this long, then `onComplete` unmounts it. */
const CELEBRATION_MS = 700;
/** Ring + number sweep — slightly shorter so the settle reads before fade. */
const SWEEP_MS = 520;

/** Per-celebration centre copy. Streak callers pass `milestone` separately via
 *  the caller; the moment itself shows a fixed glyph + label so the primitive
 *  stays pure. The macro hit reuses `goal-hit` (no separate asset — ENG-798). */
const CELEBRATION_LABEL: Record<WinMomentCelebration, string> = {
  "goal-hit": "Goal hit",
  streak: "Streak!",
  "log-confirm": "Logged",
};

/**
 * Confetti — a fixed ring of small gold dots that fly outward + fade. Pure
 * code (no asset); deterministic angles so it reads as a tidy burst, not
 * noise. Skipped entirely under reduce-motion by the parent.
 */
const CONFETTI_COUNT = 12;

function ConfettiDot({
  angleRad,
  travel,
  delay,
  color,
}: {
  angleRad: number;
  travel: number;
  delay: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: CELEBRATION_MS - delay, easing: Easing.out(Easing.quad) }),
    );
    return () => cancelAnimation(progress);
  }, [delay, progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,
      transform: [
        { translateX: Math.cos(angleRad) * travel * p },
        { translateY: Math.sin(angleRad) * travel * p },
        { scale: 0.6 + p * 0.6 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: 7,
          height: 7,
          borderRadius: 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export function WinMomentPlayer({
  celebration,
  milestone,
  onComplete,
  size = 220,
  fullBleed = false,
  testID,
}: WinMomentPlayerProps) {
  const reduceMotion = useReduceMotion();
  const streakMilestone = showStreakMilestoneDisplay(celebration, milestone);
  // Win-moment gradient — the clay-mid Sloe brand gradient (plum → clay →
  // honey). The Frost secondary-colour exploration was retired 2026-06-08
  // (ENG-997), so `useWinGradient()` now always returns this clay gradient.
  // The static `Accent.win` fill/track/text stays damson (the win role is the
  // scarce brand-identity damson, distinct from the functional clay accent).
  const winGradient = useWinGradient();

  // Ring geometry — a single gold gradient arc inside the player box.
  const stroke = Math.max(8, Math.round(size * 0.045));
  const r = size / 2 - stroke - 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;

  // Animated drivers.
  const sweep = useSharedValue(0); // 0→1 ring fill + number odometer
  const pulse = useSharedValue(0); // 0→1→0 radial bloom behind the ring
  const [displayPct, setDisplayPct] = React.useState(
    reduceMotion || streakMilestone ? 100 : 0,
  );

  // Unique gold-gradient id (avoids SVG <Defs> id collisions if two players
  // ever co-mount). `useId()` returns a string with colons (e.g. `:r0:`),
  // which are INVALID in SVG `id` / `url(#…)` references — strip them so the
  // gradient stroke actually resolves on-device.
  const rawId = React.useId();
  const gradId = `winGold-${rawId.replace(/:/g, "")}`;

  React.useEffect(() => {
    let completeTimer: ReturnType<typeof setTimeout> | undefined;

    if (streakMilestone) {
      sweep.value = 1;
      completeTimer = setTimeout(() => onComplete?.(), CELEBRATION_MS);
      return () => {
        if (completeTimer) clearTimeout(completeTimer);
      };
    }

    if (reduceMotion) {
      // Reduce-motion: snap the ring full + show 100%, no sweep/pulse/confetti.
      sweep.value = 1;
      setDisplayPct(100);
      completeTimer = setTimeout(() => onComplete?.(), CELEBRATION_MS);
      return () => {
        if (completeTimer) clearTimeout(completeTimer);
      };
    }

    // Ring sweep (and number odometer driven off the same curve below).
    sweep.value = withTiming(1, {
      duration: SWEEP_MS,
      easing: Easing.out(Easing.cubic),
    });
    // Radial bloom: quick in, gentle out.
    pulse.value = withSequence(
      withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: CELEBRATION_MS - 200, easing: Easing.out(Easing.quad) }),
    );

    // Odometer the centre % up to 100 over the sweep, on the JS thread (a
    // single Text node, ~SWEEP_MS — cheap; mirrors CalorieRing's RAF count-up).
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / SWEEP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPct(Math.round(eased * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplayPct(100);
    };
    raf = requestAnimationFrame(tick);

    // The full celebration window owns completion. A single JS timer (not a
    // worklet callback) drives `onComplete` so there is exactly one completion
    // path that can never double-fire.
    completeTimer = setTimeout(() => onComplete?.(), CELEBRATION_MS);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimation(sweep);
      cancelAnimation(pulse);
      if (completeTimer) clearTimeout(completeTimer);
    };
    // Intentionally run once per mount — the caller remounts for each
    // celebration, so a single run is the contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - sweep.value),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.22,
    transform: [{ scale: 0.7 + pulse.value * 0.6 }],
  }));

  const wrapperStyle: ViewStyle = fullBleed
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }
    : {
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      };

  return (
    <View style={wrapperStyle} testID={testID ?? "win-moment-player"}>
      <View
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      >
        {/* Gold radial bloom behind the ring. */}
        {!reduceMotion ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: size * 0.92,
                height: size * 0.92,
                borderRadius: (size * 0.92) / 2,
                backgroundColor: Accent.win,
              },
              pulseStyle,
            ]}
          />
        ) : null}

        {/* Gold-gradient ring that sweeps to completion. */}
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Defs>
            <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              {winGradient.stops.map((c, i) => (
                <Stop
                  key={c}
                  offset={`${winGradient.offsets[i] * 100}%`}
                  stopColor={c}
                />
              ))}
            </LinearGradient>
          </Defs>
          {/* Faint track so a partial sweep still reads as a ring. */}
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={Accent.win}
            strokeWidth={stroke}
            opacity={0.14}
          />
          <AnimatedCircle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            animatedProps={reduceMotion ? undefined : ringProps}
            strokeDashoffset={reduceMotion ? 0 : undefined}
            rotation="-90"
            origin={`${cx},${cx}`}
          />
        </Svg>

        {/* Confetti burst — only when motion is allowed. */}
        {!reduceMotion
          ? Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
              const angle = (i / CONFETTI_COUNT) * Math.PI * 2;
              const stop = winGradient.stops[i % winGradient.stops.length];
              return (
                <ConfettiDot
                  key={i}
                  angleRad={angle}
                  travel={size * 0.48}
                  delay={140 + (i % 4) * 30}
                  color={stop}
                />
              );
            })
          : null}

        {/* Centre hero — odometer % + landmark label, both in gold. */}
        <View style={{ alignItems: "center", gap: 2 }} pointerEvents="none">
          <Text
            testID={streakMilestone ? "win-moment-milestone" : "win-moment-pct"}
            style={{
              ...Type.ringValue,
              fontSize: streakMilestone ? 56 : 36,
              lineHeight: streakMilestone ? 56 : 36,
              color: Accent.win,
              fontVariant: ["tabular-nums"],
            }}
          >
            {streakMilestone ? String(milestone) : `${displayPct}%`}
          </Text>
          <Text
            style={{
              ...Type.label,
              color: Accent.win,
            }}
          >
            {streakMilestone ? STREAK_WIN_SUBHEAD : CELEBRATION_LABEL[celebration]}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default WinMomentPlayer;
