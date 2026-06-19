import { memo } from "react";
import * as React from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PostOnboardingPushExplainer — one-time modal shown on the first
 * Today render after `onboarding_completed=1`.
 *
 * Activation hook (audit 2026-04-30 — competitor-vs-Suppr leak fix
 * #4). The MobilePermissionsStep was removed from the linear flow in
 * the 15→12 onboarding shrink, so unless we re-prompt elsewhere
 * push-permission stays at the OS default (`undetermined`) and no
 * D1/D7/D30 retention nudge can deliver. We surface the prompt as a
 * single-screen explainer post-onboarding with calm framing — no
 * scare copy, an explicit "Maybe" and an explicit "Notify me".
 *
 * Coordinates with `OnboardingNudgeBanner` (commit c60af6d): this
 * fires FIRST on the post-onboarding launch; the nudge queue's lower-
 * priority items (`import`, `recipes`) fire afterwards. The
 * `permissions` nudge in that queue handles the case where the user
 * dismissed THIS prompt and we need to re-ask later — it is gated
 * the same way (HealthKit + Notifications combined).
 *
 * iOS-only: notifications are an iOS-native concern in this product.
 * Android handling is out-of-scope (the host already short-circuits
 * Platform.OS !== "ios" in the trigger effect).
 *
 * Visibility lifecycle is host-owned:
 *   - Host reads `suppr.post-onboarding-push-prompt.v1` from
 *     AsyncStorage. If unset AND user has `onboarding_completed=true`
 *     AND OS permission is `undetermined`, host renders this with
 *     `visible=true`.
 *   - "Maybe" tap → host calls `onSkip`, writes the storage key,
 *     and hides.
 *   - "Notify me" tap → host calls `onEnable` which runs the OS
 *     prompt + Expo push token registration, then writes the storage
 *     key.
 *
 * Web parity: web has no equivalent surface — push notifications on
 * web would route through Web Push (different API). Out-of-scope for
 * this audit fix. Logged in the activation-hooks commit so
 * sync-enforcer can pick it up.
 */
export interface PostOnboardingPushExplainerProps {
  visible: boolean;
  onSkip: () => void;
  onEnable: () => void;
}

function PostOnboardingPushExplainerImpl(
  props: PostOnboardingPushExplainerProps,
) {
  const { visible, onSkip, onEnable } = props;
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the bell icon ring
  // and the "Notify me" CTA.
  const accent = useAccent();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onSkip}
    >
      <View style={styles.scrim}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.cardBorder,
              paddingBottom:
                Platform.OS === "ios"
                  ? Math.max(insets.bottom, Spacing.xl)
                  : Spacing.xl,
            },
          ]}
        >
          <View
            style={[
              styles.iconRing,
              { backgroundColor: accent.primary + "1A" },
            ]}
          >
            <Bell size={28} color={accent.primary} strokeWidth={2.25} />
          </View>

          <Text style={[styles.heading, { color: colors.text }]}>
            A quiet ping when it&apos;s time?
          </Text>

          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {
              "Want a quiet ping when it's time to log dinner? You can always change this in Settings."
            }
          </Text>

          {/* Sloe treatment system (2026-06-08): primary inline CTA →
              aubergine outline (transparent fill + 1.5px primarySolid
              border + primarySolid label). This is a permission opt-in,
              not a paywall/onboarding-continue, so it takes the outline
              rather than the reserved filled treatment. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notify me"
            onPress={onEnable}
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: "transparent",
                borderWidth: 1.5,
                borderColor: accent.primarySolid,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.primaryBtnText, { color: accent.primarySolid }]}>Notify me</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
            onPress={onSkip}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text
              style={[styles.secondaryBtnText, { color: colors.textSecondary }]}
            >
              Maybe
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    alignItems: "center",
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  primaryBtn: {
    height: 52,
    borderRadius: Radius.md,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: Colors.light.primaryForeground,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    height: 44,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xs,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export const PostOnboardingPushExplainer = memo(PostOnboardingPushExplainerImpl);

export default PostOnboardingPushExplainer;
