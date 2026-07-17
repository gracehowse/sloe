import React, { memo, useEffect } from "react";
import { Text, View } from "react-native";
import { Sparkles, X } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, ShadowColor, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";

/**
 * AiFirstLogTooltip — one-time inline bubble shown beneath the user's
 * first AI-sourced meal row on Today.
 *
 * Phase 5 (2026-04-30) replacement for the per-day "Includes N AI-
 * estimated meals" sentinel that used to render inside `TodayHero`.
 * customer-lens flagged the daily caption as a defensive disclaimer
 * that contradicted the 2026-04-27 strategic direction (macro-first,
 * not AI-first). The new model: show one tooltip the first time a
 * user logs via photo or voice, never again. After that, AI-sourced
 * meals carry the SourceDot pill on the row (already present) and
 * nothing more — the user has been told once.
 *
 * Visibility lifecycle is host-owned:
 *   - host reads `suppr.ai-explainer-shown.v1` from AsyncStorage on
 *     mount. If unset, host watches today's meals; the first AI-
 *     sourced row makes `visible` true on this component.
 *   - X tap → host calls `onDismiss`, writes the storage key, and
 *     hides.
 *   - 6-second auto-fade → component itself calls `onDismiss` so the
 *     host can persist + hide via the same path. Auto-fade and X tap
 *     converge on one cleanup path.
 *
 * The component renders inline (not absolute-positioned) so the meal
 * row above it does not need any layout reorganisation; the host
 * places it directly below the meal row in the JSX tree.
 *
 * Theming: the secondary accent comes from `useAccent()` (Frost flag →
 * damson, else clay). Background uses `accent.primarySoft` (the sanctioned
 * Soft step, ENG-1521) for a subtle tint that reads as info, not warning.
 *
 * Web parity: web has no equivalent surface yet — the AI sentinel
 * never shipped on `today-hero-ring.tsx`, so there is nothing to
 * replace. If/when web grows photo + voice logging, the same one-
 * time-tooltip pattern should be mirrored there. Logged in the
 * Phase 5 commit so sync-enforcer can pick it up.
 */
export interface AiFirstLogTooltipProps {
  visible: boolean;
  onDismiss: () => void;
  /**
   * Auto-fade timeout in ms. Default 6000ms. Exposed for tests so
   * they can drive the timer with `vi.useFakeTimers()` without
   * waiting six real seconds.
   */
  autoFadeMs?: number;
}

const DEFAULT_AUTO_FADE_MS = 6000;

function AiFirstLogTooltipImpl(props: AiFirstLogTooltipProps) {
  const { visible, onDismiss, autoFadeMs = DEFAULT_AUTO_FADE_MS } = props;
  // Secondary accent (Frost flag → damson, else clay) for the tooltip tint,
  // icon, text, and dismiss glyph. Read before the early return so the hook
  // is stable.
  const accent = useAccent();

  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => {
      onDismiss();
    }, autoFadeMs);
    return () => clearTimeout(handle);
  }, [visible, autoFadeMs, onDismiss]);

  if (!visible) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="AI estimation explanation"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        marginHorizontal: Spacing.md,
        marginVertical: Spacing.xs,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        backgroundColor: accent.primarySoft,
        borderWidth: 1,
        borderColor: accent.primarySoftStrong,
        // Subtle elevation so the bubble lifts off the meal row
        // beneath it without dominating the card.
        shadowColor: ShadowColor.cast,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      <Sparkles size={14} color={accent.primary} strokeWidth={2.25} />
      <Text
        style={{
          flex: 1,
          ...Type.captionSmall,
          lineHeight: 16,
          color: accent.primarySolid,
          fontWeight: "500",
        }}
      >
        We fill in nutrition for photos &amp; voice. Tap to verify or edit.
      </Text>
      <PressableScale
        haptic="selection"
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tooltip"
        hitSlop={10}
        style={{
          width: 22,
          height: 22,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 11,
        }}
      >
        <X size={14} color={accent.primary} strokeWidth={2.25} />
      </PressableScale>
    </View>
  );
}

export const AiFirstLogTooltip = memo(AiFirstLogTooltipImpl);

export default AiFirstLogTooltip;
