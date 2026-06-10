/**
 * AiPaywallSheet (M2, 2026-04-18) — mobile bottom-sheet mirror of
 * `src/app/components/suppr/ai-paywall-dialog.tsx`.
 *
 * Shown when a free or Base user taps the Voice / Snap entry point on
 * Today. Previously the mobile app pushed to `/paywall?from=...` which
 * is a commercial-intent surface; this in-flow gate keeps the user in
 * context. The full-route `/paywall` is still reachable via the primary
 * CTA so the old destination is never lost.
 *
 * Copy rules (shared with web):
 *  - Factual, not pushy. No countdowns. No shame.
 *  - State exactly which feature is gated and why.
 *  - Primary CTA routes to `/paywall?from=voice_log|photo_log`.
 *  - Secondary dismiss is labelled "Not now".
 *
 * Accessibility:
 *  - `accessibilityViewIsModal` so VoiceOver / TalkBack trap focus on
 *    the sheet content while it is visible.
 *  - Title receives focus on mount via
 *    `AccessibilityInfo.setAccessibilityFocus(titleNode)`.
 *  - `Modal onRequestClose` handles Android hardware back.
 *  - Animation honours `AccessibilityInfo.isReduceMotionEnabled()` — we
 *    switch `Modal animationType` from `"fade"` to `"none"` when reduce
 *    motion is on so the sheet appears instantly.
 *
 * Analytics (fires on both platforms with identical payloads — see
 * `src/lib/analytics/events.ts`):
 *  - `ai_paywall_sheet_viewed { feature }` — on open.
 *  - `ai_paywall_sheet_dismissed { feature, reason }` — on every dismiss
 *    path with `reason: "backdrop" | "close_button" | "not_now"`.
 *  - `ai_paywall_sheet_cta_tapped { feature, action: "see_plans" }` —
 *    on primary CTA tap.
 *
 * Tokens only — no hex literals. `Accent` / `Radius` / `Spacing` only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  Text,
  View,
  findNodeHandle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import Badge from "./Badge";

export type AiPaywallFeature = "voice_log" | "photo_log";

/**
 * Shared copy constants. Mirrors `FEATURE_COPY` in the web dialog.
 *
 * 2026-05-02 — `photo_log` copy updated to reference the user's
 * just-experienced free taster (5/week). The sheet now lands ONLY
 * after exhaustion (PhotoLogSheet calls `onUpgradeRequired` on 403),
 * so the copy can name the experience the user just had. See
 * `docs/decisions/2026-05-02-photo-log-free-taster.md`.
 */
const FEATURE_COPY: Record<AiPaywallFeature, { title: string; body: string }> = {
  voice_log: {
    title: "Voice logging is a Pro feature",
    body: "Describe what you ate, and we'll estimate macros using our verified nutrition database. Voice logging is included with a Pro subscription.",
  },
  photo_log: {
    // 2026-05-13 (premium-bar audit Group I #6): "unlimited" + "100/day"
    // is a contradiction at first read. Cap reads as the qualifier on
    // AI logging only, framed as the daily allowance ("up to 100").
    title: "Get more photo logs with Pro",
    body: "You've used all 5 of your free photo logs this week. Pro unlocks AI photo logging up to 100 a day — snap any meal and we'll identify foods, estimate portions, and match against our verified nutrition database.",
  },
};

type Theme = {
  text: string;
  textSecondary: string;
  card: string;
  border: string;
  background: string;
};

export type AiPaywallSheetProps = {
  visible: boolean;
  feature: AiPaywallFeature;
  /**
   * Fires on every dismiss path. Callers typically just close the sheet
   * in response — the analytics fire happens inside the sheet.
   */
  onClose: (reason: "backdrop" | "close_button" | "not_now") => void;
  /**
   * Fires when the user taps the primary CTA. Callers route to
   * `/paywall?from=voice_log|photo_log` and close the sheet. Analytics
   * for the tap are already fired inside the sheet.
   */
  onSeePlans: (feature: AiPaywallFeature) => void;
  colors: Theme;
};

export default function AiPaywallSheet({
  visible,
  feature,
  onClose,
  onSeePlans,
  colors,
}: AiPaywallSheetProps) {
  // Secondary accent (Frost flag → damson, else clay) for the upgrade CTA.
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const copy = FEATURE_COPY[feature];
  const titleRef = useRef<Text | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Honour reduce-motion. Checked on every open so a user who toggles
  // the OS preference between sessions gets the correct animation.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => {
        if (!cancelled) setReduceMotion(rm);
      })
      .catch(() => {
        /* ignore — default false */
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Fire `ai_paywall_sheet_viewed` exactly once per open, and move
  // accessibility focus to the title so VoiceOver / TalkBack announce
  // the paywall rather than whatever was focused in the host screen.
  useEffect(() => {
    if (!visible) return;
    track(AnalyticsEvents.ai_paywall_sheet_viewed, { feature });
    const node = titleRef.current;
    if (node) {
      const handle = findNodeHandle(node);
      if (handle != null) {
        // Defer one frame so the Modal has actually mounted the view.
        const id = setTimeout(() => {
          AccessibilityInfo.setAccessibilityFocus(handle);
        }, 0);
        return () => clearTimeout(id);
      }
    }
  }, [visible, feature]);

  const dismiss = useCallback(
    (reason: "backdrop" | "close_button" | "not_now") => {
      track(AnalyticsEvents.ai_paywall_sheet_dismissed, { feature, reason });
      onClose(reason);
    },
    [feature, onClose],
  );

  const handleSeePlans = useCallback(() => {
    track(AnalyticsEvents.ai_paywall_sheet_cta_tapped, {
      feature,
      action: "see_plans",
    });
    // Selection haptic — matches the other primary-action chips on Today.
    Haptics.selectionAsync().catch(() => {
      /* haptics is best-effort */
    });
    onSeePlans(feature);
  }, [feature, onSeePlans]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={() => dismiss("backdrop")}
    >
      {/* Backdrop — tap dismisses. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => dismiss("backdrop")}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        }}
      >
        {/* Sheet — stop propagation so taps inside don't dismiss. */}
        <Pressable
          accessibilityViewIsModal
          importantForAccessibility="yes"
          onPress={() => {
            /* swallow */
          }}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingHorizontal: Spacing.xl,
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.lg,
            minHeight: 280,
            maxHeight: 420,
          }}
        >
          {/* Drag pill (cosmetic — no gesture in v1). */}
          <View style={{ alignItems: "center", marginTop: 0 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                marginTop: 0,
              }}
            />
          </View>

          {/* Close icon top-right (32x32). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            onPress={() => dismiss("close_button")}
            style={{
              position: "absolute",
              top: Spacing.md,
              right: Spacing.md,
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: Radius.full,
            }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>

          {/* PRO badge, left-aligned. */}
          <View style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}>
            <Badge variant="pro">PRO</Badge>
          </View>

          {/* Title. */}
          <Text
            ref={titleRef}
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: "700", color: colors.text }}
          >
            {copy.title}
          </Text>

          {/* Description. */}
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              lineHeight: 20,
              marginTop: Spacing.sm,
            }}
          >
            {copy.body}
          </Text>

          {/* Spacer before the CTAs — Spacing.xl. */}
          <View style={{ height: Spacing.xl }} />

          {/* Primary CTA — See Pro plans. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See Pro plans"
            onPress={handleSeePlans}
            style={{
              backgroundColor: accent.primary,
              borderRadius: Radius.md,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff" }}>
              See Pro plans
            </Text>
          </Pressable>

          {/* Secondary CTA — Not now (ghost). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            onPress={() => dismiss("not_now")}
            style={{
              paddingVertical: 12,
              alignItems: "center",
              justifyContent: "center",
              marginTop: Spacing.xs,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.textSecondary,
              }}
            >
              Not now
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
