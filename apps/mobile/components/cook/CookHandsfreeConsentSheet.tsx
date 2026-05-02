/**
 * CookHandsfreeConsentSheet — pre-permission explainer (v2, 2026-05-02).
 *
 * Renders before the iOS mic permission prompt the first time a user
 * flips the in-cook handsfree toggle to ON. Required by the legal
 * review (P1) so the user understands the on-device-only privacy
 * posture BEFORE the system dialog fires — once the iOS prompt is
 * shown we can't take a second swing at the framing.
 *
 * Layout follows the design spec section 5:
 *   - Title  20pt/700 — "Cook with your voice."
 *   - Body   15pt/400 — what the listener does + the on-device claim.
 *   - Three icon rows (Mic / EyeOff / Power) summarising the privacy
 *     properties so a user who skims still sees the three commitments.
 *   - Primary CTA "Turn on voice control" → triggers iOS permission
 *     request, persists `consent_v1` flag.
 *   - Secondary text-button "Not now" → dismisses without persisting.
 *
 * After "Turn on voice control":
 *   1. Persist `suppr.cook.handsfree.consent_v1 = "1"` so the sheet
 *      never re-shows on this device.
 *   2. Call `requestPermissionsAsync()` from the speech-recognition
 *      module — that triggers the OS-level mic + speech-recognition
 *      consent dialogs.
 *   3. Resolve the parent's `onConsentGranted(granted)` callback with
 *      the iOS permission outcome so cook.tsx can either start the
 *      listener or revert the toggle to OFF.
 *
 * Tokens only — no hex literals. Mirrors the patterns already used in
 * `AiPaywallSheet.tsx` (Modal + animated backdrop + insets-aware
 * bottom sheet).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Mic, EyeOff, Power } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { writeHandsfreeConsent } from "@/lib/cookHandsfree";
import { requestHandsfreePermissions } from "@/lib/cookHandsfreeListener";

export type CookHandsfreeConsentSheetProps = {
  visible: boolean;
  /**
   * Fires when the user has tapped "Turn on voice control" AND the iOS
   * permission flow has resolved. `granted` reflects the OS outcome.
   * Callers should:
   *   - granted=true → start the listener and update the toggle to ON.
   *   - granted=false → close the sheet, revert the toggle to OFF, and
   *     surface a one-shot "Voice control needs microphone access in
   *     Settings" hint (cook.tsx handles this).
   */
  onConsentGranted: (granted: boolean) => void;
  /** Fires when the user dismisses without granting — Not Now, backdrop
   *  tap, hardware back. The toggle should revert to OFF. */
  onDismiss: () => void;
};

export default function CookHandsfreeConsentSheet({
  visible,
  onConsentGranted,
  onDismiss,
}: CookHandsfreeConsentSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const titleRef = useRef<Text | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [pending, setPending] = useState(false);

  // Honour reduce-motion. Same pattern as AiPaywallSheet.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => {
        if (!cancelled) setReduceMotion(rm);
      })
      .catch(() => {
        /* default false */
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Move accessibility focus to title on open so VoiceOver announces
  // the explainer rather than whatever was focused in the host screen.
  useEffect(() => {
    if (!visible) return;
    const node = titleRef.current;
    if (!node) return;
    const handle = findNodeHandle(node);
    if (handle == null) return;
    const id = setTimeout(() => {
      AccessibilityInfo.setAccessibilityFocus(handle);
    }, 0);
    return () => clearTimeout(id);
  }, [visible]);

  const handleTurnOn = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      // 1. Persist the consent ack BEFORE the OS prompt — even if the
      //    user denies the iOS prompt, we don't want to re-show this
      //    sheet next time. They've seen the privacy framing; the
      //    next time they tap the mic toggle they go straight to iOS
      //    Settings (cook.tsx renders the "needs mic access" hint).
      await writeHandsfreeConsent();
      // 2. Trigger the iOS combined Speech-Recognition + Microphone
      //    consent dialog. This may resolve immediately (already
      //    granted) or after the user responds to the system prompt.
      const granted = await requestHandsfreePermissions();
      onConsentGranted(granted);
    } finally {
      setPending(false);
    }
  }, [onConsentGranted, pending]);

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: insets.bottom + Spacing.lg,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      marginTop: Spacing.lg,
    },
    body: {
      fontSize: 15,
      fontWeight: "400",
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: Spacing.sm,
    },
    rowsBlock: {
      marginTop: Spacing.xl,
      gap: Spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.md,
    },
    rowIconWrap: {
      width: 32,
      height: 32,
      borderRadius: Radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Accent.primary + "16",
    },
    rowText: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    primaryBtn: {
      marginTop: Spacing.xl,
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
    primaryBtnPending: { opacity: 0.6 },
    secondaryBtn: {
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      marginTop: Spacing.xs,
    },
    secondaryBtnText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onDismiss}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityViewIsModal
          importantForAccessibility="yes"
          onPress={() => {
            /* swallow */
          }}
          style={styles.sheet}
          testID="cook-handsfree-consent-sheet"
        >
          <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no" />

          <Text
            ref={titleRef}
            accessibilityRole="header"
            style={styles.title}
          >
            Cook with your voice.
          </Text>

          <Text style={styles.body}>
            Suppr listens for next, back, repeat, pause, and resume while cook mode is open. Audio is processed on your device and never sent to our servers. We don&apos;t keep recordings.
          </Text>

          <View style={styles.rowsBlock}>
            <View style={styles.row}>
              <View style={styles.rowIconWrap}>
                <Mic size={18} color={Accent.primary} strokeWidth={2} />
              </View>
              <Text style={styles.rowText}>On-device speech recognition</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.rowIconWrap}>
                <EyeOff size={18} color={Accent.primary} strokeWidth={2} />
              </View>
              <Text style={styles.rowText}>No audio leaves your phone</Text>
            </View>
            <View style={styles.row}>
              <View style={styles.rowIconWrap}>
                <Power size={18} color={Accent.primary} strokeWidth={2} />
              </View>
              <Text style={styles.rowText}>
                Stops the moment you exit cook mode or flip the toggle off
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Turn on voice control"
            testID="cook-handsfree-consent-primary"
            onPress={handleTurnOn}
            disabled={pending}
            style={[
              styles.primaryBtn,
              pending && styles.primaryBtnPending,
            ]}
          >
            <Text style={styles.primaryBtnText}>Turn on voice control</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not now"
            testID="cook-handsfree-consent-secondary"
            onPress={onDismiss}
            disabled={pending}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
