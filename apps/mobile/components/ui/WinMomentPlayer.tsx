/**
 * WinMomentPlayer — reserved landmark-celebration primitive (mobile).
 *
 * The single component that renders a Lottie win-moment for the three
 * landmark celebrations in the product:
 *   - `goal-hit`     — calorie ring closed at/under target for the day
 *   - `streak`       — a logging-streak milestone was reached
 *   - `log-confirm`  — a quiet, one-shot confirm flourish on commit
 *
 * Design contract (ENG-810):
 *   - **Lazy-loaded.** `lottie-react-native` is a native module with a
 *     non-trivial bundle cost. It is pulled in via `React.lazy` so the
 *     animation runtime only loads the first time a win-moment actually
 *     mounts — Today cold-open never pays for it.
 *   - **No autoplay unless mounted.** The component has zero visual
 *     footprint until the caller mounts it. On mount it plays exactly
 *     once (no loop) and calls `onComplete` when the animation finishes,
 *     so the caller can unmount it. Callers are expected to gate the
 *     mount behind `isFeatureEnabled('redesign_winmoment')` and the
 *     relevant once-per-day / once-per-milestone logic — this primitive
 *     does not own that gate.
 *
 * The real `.lottie` / `.json` sources are wired in a later content pass
 * (ENG-798). For now each celebration points at a tiny inline no-op
 * animation source (`PLACEHOLDER_SOURCE`) so the component compiles,
 * mounts, and fires `onComplete` end-to-end without shipping a real
 * asset yet.
 *
 * Web mirror at `src/app/components/ui/win-moment-player.tsx`. Same prop
 * signature so callers read identically across platforms.
 */
import * as React from "react";
import { View, type ViewStyle } from "react-native";

export type WinMomentCelebration = "goal-hit" | "streak" | "log-confirm";

export interface WinMomentPlayerProps {
  /** Which landmark celebration to play. Drives the animation source. */
  celebration: WinMomentCelebration;
  /** Fired once the (single, non-looping) animation finishes. Use this to
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

/**
 * A 1-frame, fully-transparent Lottie document. Valid enough for
 * `lottie-react-native` to mount and immediately report completion, with
 * no visible pixels. Replaced per-celebration by real assets in ENG-798.
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
 * placeholder; ENG-798 swaps each entry for its real `.lottie` asset
 * (`goal-hit` → confetti, `streak` → flame burst, `log-confirm` → tick).
 */
const CELEBRATION_SOURCE: Record<WinMomentCelebration, unknown> = {
  "goal-hit": PLACEHOLDER_SOURCE,
  streak: PLACEHOLDER_SOURCE,
  "log-confirm": PLACEHOLDER_SOURCE,
};

/**
 * Lazy boundary for the native Lottie runtime. Wrapped in a default-export
 * shim because `React.lazy` requires a module with a `default` export, and
 * we want to adapt `LottieView`'s `onAnimationFinish` → our `onComplete`
 * here rather than at every call site.
 */
const LazyLottie = React.lazy(async () => {
  const mod = await import("lottie-react-native");
  const LottieView = mod.default;

  const Adapter: React.FC<{
    source: unknown;
    onComplete?: () => void;
    style?: ViewStyle;
    testID?: string;
  }> = ({ source, onComplete, style, testID }) => (
    <LottieView
      // `source` typing in lottie-react-native is a JSON object or require()'d
      // asset; our inline placeholder satisfies it at runtime.
      source={source as never}
      autoPlay
      loop={false}
      onAnimationFinish={() => onComplete?.()}
      style={style}
      testID={testID}
    />
  );

  return { default: Adapter };
});

export function WinMomentPlayer({
  celebration,
  onComplete,
  size = 220,
  fullBleed = false,
  testID,
}: WinMomentPlayerProps) {
  const source = CELEBRATION_SOURCE[celebration];

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
    : { width: size, height: size, pointerEvents: "none" };

  const lottieStyle: ViewStyle = { width: size, height: size };

  return (
    <View style={wrapperStyle} testID={testID ?? "win-moment-player"}>
      {/* No fallback UI: the player is silent until the (lazy) runtime is
          ready, then plays once. An empty Suspense fallback keeps it
          invisible during the one-time module load. */}
      <React.Suspense fallback={null}>
        <LazyLottie
          source={source}
          onComplete={onComplete}
          style={lottieStyle}
        />
      </React.Suspense>
    </View>
  );
}

export default WinMomentPlayer;
