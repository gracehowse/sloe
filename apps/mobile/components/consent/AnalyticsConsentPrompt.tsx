import * as React from "react";
import { Linking, Text, View } from "react-native";
import { BarChart3 } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { Elevation, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useAnalyticsConsent } from "@/lib/analyticsConsent";
import { getSupprWebBase } from "@/lib/supprWeb";

/**
 * ENG-1286 — the mobile analytics-consent ask moment (launch blocker).
 *
 * Mirror of the web `CookieConsent` bottom strip: a NON-MODAL card
 * anchored above the tab bar, shown on the first authenticated app
 * open (the tabs shell mounts only post-login + post-onboarding) and
 * on every launch until the user answers. Non-modal on purpose —
 * web's banner never blocks the product, and the post-onboarding push
 * explainer (`PostOnboardingPushExplainer`) already owns the modal
 * moment on first Today render; a second stacked `Modal` would
 * collide with it.
 *
 * Consent semantics come from `lib/analyticsConsent` (same
 * accepted/declined/null states as web). Until the user accepts,
 * `getPostHogClient()` returns null — no analytics, no session
 * replay. Accept and Decline carry EQUAL visual prominence (side by
 * side, same size — the UK/EU equal-prominence posture the web banner
 * documents); the treatments match the onboarding `PermissionCard`
 * Allow / Not now pair exactly (same element, same treatment).
 *
 * No analytics event fires from this surface by design: a decline
 * must never be captured (that would be capture-before-consent), and
 * an accept is already visible via the `posthog_health_check`
 * sentinel the AnalyticsProvider fires when it adopts the client —
 * intentionally event-free, not a gap.
 */
export function AnalyticsConsentPrompt() {
  const colors = useThemeColors();
  const accent = useAccent();
  const tabBarClearance = useTabBarClearance();
  const [consent, setConsent] = useAnalyticsConsent();
  // Distinguish "hydrating" from "never asked": useAnalyticsConsent
  // starts from the primed in-memory value, but on a cold first launch
  // that is null both while reading storage AND when genuinely unset.
  // Waiting one storage round-trip avoids a flash-then-dismiss if a
  // stored choice exists but the module wasn't primed yet.
  const [hydrated, setHydrated] = React.useState(false);
  const [busy, setBusy] = React.useState<"accepted" | "declined" | null>(null);

  React.useEffect(() => {
    // useAnalyticsConsent's own hydrate effect resolves the stored
    // value; this flag just delays first paint until that microtask
    // queue has had a chance to run.
    let cancelled = false;
    const id = setTimeout(() => {
      if (!cancelled) setHydrated(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

  const choose = React.useCallback(
    (choice: "accepted" | "declined") => {
      if (busy) return;
      setBusy(choice);
      void setConsent(choice).finally(() => setBusy(null));
    },
    [busy, setConsent],
  );

  if (!hydrated || consent !== null) return null;

  const privacyBase = getSupprWebBase();

  return (
    <View
      testID="analytics-consent-prompt"
      accessibilityLabel="Analytics consent"
      style={{
        position: "absolute",
        left: Spacing.md,
        right: Spacing.md,
        bottom: tabBarClearance + Spacing.sm,
        backgroundColor: colors.card,
        borderRadius: CARD_RADIUS,
        borderWidth: 1,
        borderColor: colors.border,
        padding: Spacing.md,
        gap: Spacing.dense,
        ...Elevation.sheet,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Spacing.dense,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.full,
            backgroundColor: accent.primary + "1A",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BarChart3 size={18} color={accent.primary} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...Type.headline, color: colors.text }}>
            Help improve Sloe
          </Text>
          <Text
            style={{
              ...Type.bodyMuted,
              color: colors.textSecondary,
              marginTop: Spacing.xs,
            }}
          >
            Anonymous usage analytics and masked session replay. You can
            change this anytime in Settings.
            {privacyBase ? (
              <Text
                accessibilityRole="link"
                accessibilityLabel="Privacy policy"
                style={{
                  color: accent.primarySolid,
                  textDecorationLine: "underline",
                }}
                onPress={() => {
                  void Linking.openURL(`${privacyBase}/privacy`).catch(() => {
                    /* browser unavailable — the Settings Legal row is the fallback */
                  });
                }}
              >
                {" "}
                Privacy policy
              </Text>
            ) : null}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: Spacing.dense }}>
        <PressableScale
          testID="analytics-consent-accept"
          accessibilityRole="button"
          accessibilityLabel="Allow analytics"
          accessibilityState={{ disabled: busy !== null }}
          disabled={busy !== null}
          haptic="confirm"
          onPress={() => choose("accepted")}
          style={{
            flex: 1,
            height: 40,
            borderRadius: Radius.xl,
            backgroundColor: accent.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy !== null ? 0.6 : 1,
          }}
        >
          <Text
            style={{
              ...Type.captionStrong,
              color: accent.primaryForeground,
            }}
          >
            {busy === "accepted" ? "Saving…" : "Allow"}
          </Text>
        </PressableScale>
        <PressableScale
          testID="analytics-consent-decline"
          accessibilityRole="button"
          accessibilityLabel="Decline analytics"
          accessibilityState={{ disabled: busy !== null }}
          disabled={busy !== null}
          haptic="selection"
          onPress={() => choose("declined")}
          style={{
            flex: 1,
            height: 40,
            borderRadius: Radius.xl,
            backgroundColor: colors.inputBg,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy !== null ? 0.6 : 1,
          }}
        >
          <Text style={{ ...Type.captionStrong, color: colors.text }}>
            {busy === "declined" ? "Saving…" : "No thanks"}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

export default AnalyticsConsentPrompt;
