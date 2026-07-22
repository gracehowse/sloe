import { memo } from "react";
import * as React from "react";
import { Text, View } from "react-native";
import { AlertCircle, Check, Info, type LucideIcon } from "lucide-react-native";

import { Accent, Elevation, IconButtonSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import type { ToastAction } from "@/hooks/useToast";

/**
 * Toast — shared calm, auto-fading card overlay (ENG-1344 first slice).
 *
 * Generalizes the card+icon+text+shadow shape that `PostLogSuggestionToast`
 * (today) and `PlanRegenerateToast` (planner) each independently reimplemented
 * with their own host-owned `useState`/`useEffect` auto-dismiss boilerplate.
 * This component is purely presentational — no timer, no lifecycle — pair it
 * with `useToast()` for the auto-dismiss behaviour.
 *
 * "Calm reward" posture throughout: `pointerEvents="none"`, no tap target,
 * `accessibilityRole="alert"` so VoiceOver announces it once on appearance.
 */
export type ToastVariant = "info" | "success" | "error";

const VARIANT_ICON: Record<ToastVariant, LucideIcon> = {
  info: Info,
  success: Check,
  error: AlertCircle,
};

const VARIANT_ACCENT: Record<ToastVariant, { fg: string; bg: string; border: string }> = {
  info: { fg: Accent.primary, bg: Accent.primarySoft, border: Accent.primarySoftStrong },
  success: { fg: Accent.win, bg: Accent.winSoft, border: Accent.winSoftStrong },
  error: {
    fg: Accent.destructive,
    bg: Accent.destructiveSoft,
    border: Accent.destructiveSoftStrong,
  },
};

export interface ToastProps {
  visible: boolean;
  message: string | null;
  /** Colour + default-icon family. Default "info". */
  variant?: ToastVariant;
  /** Overrides the variant's default glyph (e.g. a refresh icon for a
   *  "plan regenerated" toast) while keeping the variant's colour scheme. */
  icon?: LucideIcon;
  /** Which edge the toast anchors to. Default "top". */
  position?: "top" | "bottom";
  /** Inset from the anchored edge — pass a safe-area inset + spacing. */
  inset?: number;
  /** ENG-786 rebuild — an optional tappable action (e.g. "Undo"). Presence
   *  flips `pointerEvents` from "none" to "box-none" so only the action
   *  pill itself becomes tappable; a toast with no action stays fully
   *  passive, unchanged from before this prop existed. */
  action?: ToastAction;
  /** Called after `action.onPress()` fires, so the host can dismiss
   *  immediately rather than waiting out the auto-dismiss timer. Only
   *  meaningful when `action` is set. */
  onDismiss?: () => void;
  testID?: string;
}

function ToastImpl({
  visible,
  message,
  variant = "info",
  icon,
  position = "top",
  inset = Spacing.lg,
  action,
  onDismiss,
  testID = "toast",
}: ToastProps) {
  const colors = useThemeColors();
  if (!visible || !message) return null;

  const Icon = icon ?? VARIANT_ICON[variant];
  const accent = VARIANT_ACCENT[variant];
  const anchor = position === "top" ? { top: inset } : { bottom: inset };

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel={message}
      pointerEvents={action ? "box-none" : "none"}
      style={[
        {
          position: "absolute",
          left: Spacing.md,
          right: Spacing.md,
          zIndex: 1000,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
          borderRadius: CARD_RADIUS,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: accent.border,
          ...Elevation.float,
        },
        anchor,
      ]}
    >
      <View
        style={{
          width: IconButtonSize.sm,
          height: IconButtonSize.sm,
          borderRadius: Radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: accent.bg,
        }}
      >
        <Icon size={14} color={accent.fg} strokeWidth={2.25} />
      </View>
      <Text style={{ ...Type.body, color: colors.text, flex: 1 }}>{message}</Text>
      {action ? (
        <PressableScale
          onPress={() => {
            action.onPress();
            onDismiss?.();
          }}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          style={{ paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm }}
        >
          <Text style={{ ...Type.captionStrong, color: accent.fg }}>
            {action.label}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export const Toast = memo(ToastImpl);

export default Toast;
