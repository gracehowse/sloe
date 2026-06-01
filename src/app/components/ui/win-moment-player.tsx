"use client";

/**
 * WinMomentPlayer — reserved landmark-celebration primitive (web).
 *
 * Web mirror of `apps/mobile/components/ui/WinMomentPlayer.tsx`. Same prop
 * signature so callers read identically across platforms.
 *
 * The single component that renders a dotLottie win-moment for the three
 * landmark celebrations in the product:
 *   - `goal-hit`     — calorie ring closed at/under target for the day
 *   - `streak`       — a logging-streak milestone was reached
 *   - `log-confirm`  — a quiet, one-shot confirm flourish on commit
 *
 * Design contract (ENG-810):
 *   - **Lazy-loaded.** `@lottiefiles/dotlottie-react` ships a WASM-backed
 *     renderer that must never appear in the initial bundle. It is loaded
 *     via `next/dynamic({ ssr: false })`, so the player runtime is only
 *     fetched the first time a win-moment actually mounts.
 *   - **No autoplay unless mounted.** The component has zero visual
 *     footprint until the caller mounts it. On mount it plays exactly
 *     once (no loop) and calls `onComplete` when the animation finishes,
 *     so the caller can unmount it. Callers gate the mount behind
 *     `isFeatureEnabled('redesign_winmoment')` plus the relevant
 *     once-per-day / once-per-milestone logic — this primitive does not
 *     own that gate.
 *
 * The real dotLottie sources are wired in a later content pass (ENG-798).
 * For now each celebration points at a tiny inline no-op animation source
 * (`PLACEHOLDER_SOURCE`) so the component compiles, mounts, and fires
 * `onComplete` end-to-end without shipping a real asset yet.
 */
import * as React from "react";
import dynamic from "next/dynamic";

export type WinMomentCelebration = "goal-hit" | "streak" | "log-confirm";

export interface WinMomentPlayerProps {
  /** Which landmark celebration to play. Drives the animation source. */
  celebration: WinMomentCelebration;
  /** Fired once the (single, non-looping) animation finishes. Use this to
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

/**
 * A 1-frame, fully-transparent Lottie document. Valid enough for the
 * dotLottie renderer to mount and immediately report completion, with no
 * visible pixels. Replaced per-celebration by real assets in ENG-798.
 */
const PLACEHOLDER_SOURCE = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 1,
  w: 100,
  h: 100,
  nm: "win-placeholder",
  ddd: 0,
  assets: [],
  layers: [],
} as const;

/**
 * Per-celebration animation source. Today every key points at the shared
 * placeholder; ENG-798 swaps each entry for its real dotLottie asset
 * (`goal-hit` → confetti, `streak` → flame burst, `log-confirm` → tick).
 */
const CELEBRATION_SOURCE: Record<WinMomentCelebration, unknown> = {
  "goal-hit": PLACEHOLDER_SOURCE,
  streak: PLACEHOLDER_SOURCE,
  "log-confirm": PLACEHOLDER_SOURCE,
};

interface LazyPlayerProps {
  source: unknown;
  size: number;
  onComplete?: () => void;
}

/**
 * Lazy boundary for the dotLottie web runtime. `ssr: false` keeps the WASM
 * renderer out of the server bundle and out of the initial client bundle;
 * the chunk is fetched the first time this player mounts. The adapter wires
 * the dotLottie `complete` event → our `onComplete` so call sites stay
 * platform-agnostic.
 */
const LazyDotLottie = dynamic<LazyPlayerProps>(
  async () => {
    const mod = await import("@lottiefiles/dotlottie-react");
    const { DotLottieReact } = mod;

    const Adapter: React.FC<LazyPlayerProps> = ({
      source,
      size,
      onComplete,
    }) => {
      const handleRef = React.useCallback(
        (instance: { addEventListener?: (e: string, cb: () => void) => void } | null) => {
          // dotLottie exposes lifecycle events on the instance handed back
          // via the ref callback. Subscribe to `complete` so we mirror the
          // mobile `onAnimationFinish` semantics.
          instance?.addEventListener?.("complete", () => onComplete?.());
        },
        [onComplete],
      );

      return (
        <DotLottieReact
          // `data` accepts a parsed Lottie JSON object (its `Data` type is
          // `string | ArrayBuffer | Record<string, unknown>`); our inline
          // placeholder satisfies it at runtime.
          data={source as Record<string, unknown>}
          autoplay
          loop={false}
          dotLottieRefCallback={handleRef as never}
          style={{ width: size, height: size }}
        />
      );
    };

    return Adapter;
  },
  { ssr: false },
);

export function WinMomentPlayer({
  celebration,
  onComplete,
  size = 220,
  fullBleed = false,
  testID,
}: WinMomentPlayerProps) {
  const source = CELEBRATION_SOURCE[celebration];

  const wrapperStyle: React.CSSProperties = fullBleed
    ? {
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }
    : { width: size, height: size, pointerEvents: "none" };

  return (
    <div style={wrapperStyle} data-testid={testID ?? "win-moment-player"}>
      <LazyDotLottie source={source} size={size} onComplete={onComplete} />
    </div>
  );
}

export default WinMomentPlayer;
