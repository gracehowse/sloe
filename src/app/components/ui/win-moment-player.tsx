"use client";

/**
 * WinMomentPlayer — landmark-celebration primitive (web).
 *
 * Web mirror of `apps/mobile/components/ui/WinMomentPlayer.tsx`. Same prop
 * signature so callers read identically across platforms.
 *
 * The single component that renders the reserved win-moment for the three
 * landmark celebrations:
 *   - `goal-hit`     — calorie ring closed at/under target for the day
 *   - `streak`       — a logging-streak milestone was reached
 *   - `log-confirm`  — a quiet, one-shot confirm flourish on commit
 *
 * ## Code celebration (ENG-901, 2026-06-17)
 *
 * Previously this mounted a 1-frame TRANSPARENT dotLottie placeholder — the
 * delight peak rendered BLANK on web while mobile shipped a real gold-ring
 * celebration. It now plays a REAL, code-driven celebration built on plain
 * SVG + CSS keyframes (no Lottie/WASM dep, OTA-deployable), mirroring mobile:
 *
 *   1. A gold-gradient ring SWEEPS to completion (the calorie ring "closing"),
 *   2. a gold radial bloom PULSES behind it and fades,
 *   3. the centre number ODOMETERS up to 100% and settles, and
 *   4. subtle gold CONFETTI bursts outward.
 *
 * Runs ~700ms then fires `onComplete` so the caller can unmount it. The gold is
 * the dedicated win token (`--accent-win` + `--accent-win-gradient`) — the
 * three-role colour law keeps it landmark-only. The real bespoke `.lottie`
 * art is a future swap (ENG-798) behind the same contract; this ships the
 * moment now.
 *
 * ## Gating contract (unchanged)
 *   - **Caller owns the gate.** Zero visual footprint until mounted; does NOT
 *     read `redesign_winmoment` itself. Callers gate the mount behind the flag
 *     + the once-per-day / once-per-milestone logic.
 *   - **Plays once.** Single run on mount (no loop); calls `onComplete` at the
 *     end of the celebration window.
 *   - **Reduce-motion.** When the system flag is on, skips the
 *     sweep/pulse/confetti and shows a static gold ring + "100%", then
 *     completes on the same ~700ms beat.
 */
import * as React from "react";
import {
  STREAK_WIN_SUBHEAD,
  showStreakMilestoneDisplay,
} from "../../../lib/nutrition/winMomentStreakCopy.ts";

export type WinMomentCelebration = "goal-hit" | "streak" | "log-confirm";

export interface WinMomentPlayerProps {
  /** Which landmark celebration to play. Drives the centre label. */
  celebration: WinMomentCelebration;
  /** ENG-901 M5 — streak milestone numeral (3/7/30/100). */
  milestone?: number;
  /** Fired once the (single, non-looping) celebration finishes. Use this to
   *  unmount the player. */
  onComplete?: () => void;
  /** Square render size in px. Default 220. */
  size?: number;
  /** Absolute-fill the player over its positioned parent (full-bleed
   *  overlay). Default false — renders inline at `size`. */
  fullBleed?: boolean;
  /** Test id forwarded to the wrapper element. */
  testID?: string;
}

/** Total celebration window. The caller's overlay stays mounted this long. */
const CELEBRATION_MS = 700;
/** Ring + number sweep — shorter so the settle reads before fade. */
const SWEEP_MS = 520;
/** Fixed ring of small gold dots that fly outward + fade (deterministic). */
const CONFETTI_COUNT = 12;

const CELEBRATION_LABEL: Record<WinMomentCelebration, string> = {
  "goal-hit": "Goal hit",
  streak: "Streak!",
  "log-confirm": "Logged",
};

/** Read the win-gradient stops from the `--accent-win-gradient` token so the
 *  SVG ring stays token-driven + theme-aware (light/dark). Falls back to a
 *  solid `--accent-win` stroke when unreadable (SSR / parse miss). */
function useWinGradientStops(): string[] {
  const [stops, setStops] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        "--accent-win-gradient",
      );
      const hex = raw.match(/#[0-9a-fA-F]{3,8}/g);
      if (hex && hex.length >= 2) setStops(hex);
    } catch {
      /* keep fallback */
    }
  }, []);
  return stops;
}

function useReduceMotion(): boolean {
  const [reduce] = React.useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduce;
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
  const gradientStops = useWinGradientStops();
  const streakMilestone = showStreakMilestoneDisplay(celebration, milestone);

  // Ring geometry — a single gold arc inside the player box (mirrors mobile).
  const stroke = Math.max(8, Math.round(size * 0.045));
  const r = size / 2 - stroke - 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;

  // Unique gradient + keyframe id. `useId()` returns colons (`:r0:`) which are
  // invalid in SVG `id` / `url(#…)` and CSS animation-names — strip them.
  const uid = React.useId().replace(/:/g, "");
  const gradId = `winGold-${uid}`;

  // Centre odometer — count 0→100% over the sweep (RAF; mirrors mobile).
  const [displayPct, setDisplayPct] = React.useState(
    reduceMotion || streakMilestone ? 100 : 0,
  );

  React.useEffect(() => {
    if (streakMilestone) {
      const done = window.setTimeout(() => onComplete?.(), CELEBRATION_MS);
      return () => window.clearTimeout(done);
    }
    if (reduceMotion) {
      setDisplayPct(100);
      const done = window.setTimeout(() => onComplete?.(), CELEBRATION_MS);
      return () => window.clearTimeout(done);
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SWEEP_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPct(Math.round(eased * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplayPct(100);
    };
    raf = requestAnimationFrame(tick);
    const done = window.setTimeout(() => onComplete?.(), CELEBRATION_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
    // Run once per mount — the caller remounts for each celebration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasGradient = gradientStops.length >= 2;
  const ringStroke = hasGradient ? `url(#${gradId})` : "var(--accent-win)";

  // Per-instance keyframes (unique names; sweep bakes in this ring's circ).
  const keyframes = reduceMotion
    ? ""
    : `
@keyframes winSweep-${uid} { from { stroke-dashoffset: ${circ}; } to { stroke-dashoffset: 0; } }
@keyframes winBloom-${uid} { 0% { opacity: 0; transform: scale(0.7); } 28% { opacity: 0.22; transform: scale(1); } 100% { opacity: 0; transform: scale(1.32); } }
@keyframes winConfetti-${uid} { 0% { opacity: 0; transform: translate(0,0) scale(0.6); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(1.2); } }
`;

  const wrapperStyle: React.CSSProperties = fullBleed
    ? {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }
    : {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      };

  return (
    <div style={wrapperStyle} data-testid={testID ?? "win-moment-player"}>
      {keyframes ? <style>{keyframes}</style> : null}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Gold radial bloom behind the ring. */}
        {!reduceMotion ? (
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: size * 0.92,
              height: size * 0.92,
              borderRadius: "50%",
              background: "var(--accent-win-gradient)",
              opacity: 0,
              animation: `winBloom-${uid} ${CELEBRATION_MS}ms ease-out forwards`,
              pointerEvents: "none",
            }}
          />
        ) : null}

        {/* Gold-gradient ring that sweeps to completion. */}
        <svg
          width={size}
          height={size}
          style={{ position: "absolute", transform: "rotate(-90deg)" }}
          aria-hidden
        >
          {hasGradient ? (
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                {gradientStops.map((c, i) => (
                  <stop
                    key={`${c}-${i}`}
                    offset={`${(i / (gradientStops.length - 1)) * 100}%`}
                    stopColor={c}
                  />
                ))}
              </linearGradient>
            </defs>
          ) : null}
          {/* Faint track so a partial sweep still reads as a ring. */}
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="var(--accent-win)"
            strokeWidth={stroke}
            opacity={0.14}
          />
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={ringStroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={reduceMotion ? 0 : circ}
            style={
              reduceMotion
                ? undefined
                : {
                    animation: `winSweep-${uid} ${SWEEP_MS}ms cubic-bezier(0.33,1,0.68,1) forwards`,
                  }
            }
          />
        </svg>

        {/* Confetti burst — only when motion is allowed. */}
        {!reduceMotion
          ? Array.from({ length: CONFETTI_COUNT }).map((_, i) => {
              const angle = (i / CONFETTI_COUNT) * Math.PI * 2;
              const travel = size * 0.48;
              const delay = 140 + (i % 4) * 30;
              const color = hasGradient
                ? gradientStops[i % gradientStops.length]
                : "var(--accent-win)";
              return (
                <div
                  key={i}
                  aria-hidden
                  style={
                    {
                      position: "absolute",
                      width: 7,
                      height: 7,
                      borderRadius: 2,
                      backgroundColor: color,
                      opacity: 0,
                      "--tx": `${Math.cos(angle) * travel}px`,
                      "--ty": `${Math.sin(angle) * travel}px`,
                      animation: `winConfetti-${uid} ${CELEBRATION_MS - delay}ms ease-out ${delay}ms forwards`,
                      pointerEvents: "none",
                    } as React.CSSProperties
                  }
                />
              );
            })
          : null}

        {/* Centre hero — odometer % + landmark label, both in gold. */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            pointerEvents: "none",
          }}
        >
          <span
            data-testid={streakMilestone ? "win-moment-milestone" : "win-moment-pct"}
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: streakMilestone ? 56 : 36,
              lineHeight: streakMilestone ? "56px" : "36px",
              color: "var(--accent-win)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {streakMilestone ? milestone : `${displayPct}%`}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: streakMilestone ? "0.02em" : "0.04em",
              color: "var(--accent-win)",
            }}
          >
            {streakMilestone ? STREAK_WIN_SUBHEAD : CELEBRATION_LABEL[celebration]}
          </span>
        </div>
      </div>
    </div>
  );
}

export default WinMomentPlayer;
