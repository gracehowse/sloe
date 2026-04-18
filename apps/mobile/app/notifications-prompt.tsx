import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import {
  hasNotificationsPromptBeenDismissed,
  markNotificationsPromptDismissed,
  registerExpoPushTokenForUser,
} from "@/lib/expoPushToken";

export default function NotificationsPromptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  // `null` while we check, `true` to render, `false` to render-nothing
  // before `router.replace` swaps the route. Avoids a flash of the
  // explainer when the user has already responded.
  const [showPrompt, setShowPrompt] = useState<boolean | null>(null);
  const redirectedRef = useRef(false);

  // Mount gate (TestFlight build 7 fix): if the user already responded
  // to the OS prompt OR we have previously written the AsyncStorage
  // dismiss flag, skip the explainer entirely instead of nagging them
  // every cold launch.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const dismissed = await hasNotificationsPromptBeenDismissed();
      if (cancelled) return;
      if (dismissed) {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          router.replace("/(tabs)/discover");
        }
        return;
      }
      setShowPrompt(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onEnable() {
    try {
      const Notifications = await import("expo-notifications");
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      const existing = await Notifications.getPermissionsAsync();
      const next =
        existing.status === "granted"
          ? existing
          : await Notifications.requestPermissionsAsync();
      if (next.status === "granted") {
        // Fetch + persist the Expo push token so the server has an
        // address to push to. Failures are logged inside the helper —
        // the user still completes the flow either way.
        await registerExpoPushTokenForUser(userId);
      } else {
        Alert.alert(
          "Notifications are off",
          "You can turn them on any time in Settings → Suppr → Notifications.",
          [
            { text: "Skip", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
      }
    } catch {
      Alert.alert(
        "Not available here",
        "System notifications require a full Suppr install (not Expo Go).",
      );
    }
    // Whether the user granted, denied, or hit a missing-native-module
    // path, the prompt has done its job. Suppress it so we never re-nag.
    await markNotificationsPromptDismissed();
    router.replace("/(tabs)/discover");
  }

  async function onSkip() {
    // Skip is an informed decision — also suppress, so a deliberate
    // "no" doesn't re-prompt on every launch.
    await markNotificationsPromptDismissed();
    router.replace("/(tabs)/discover");
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.background,
      justifyContent: "center", alignItems: "center",
      paddingHorizontal: Spacing.xxl,
    },
    badge: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: Accent.success + "15",
      justifyContent: "center", alignItems: "center",
      marginBottom: Spacing.xl,
    },
    notifBadge: {
      position: "absolute", top: 0, right: 0,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: Accent.destructive, justifyContent: "center", alignItems: "center",
    },
    notifBadgeText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    heading: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", lineHeight: 30 },
    stat: {
      fontSize: 15, color: colors.textSecondary, textAlign: "center",
      marginTop: Spacing.xl, lineHeight: 22, paddingHorizontal: Spacing.lg,
    },
    statBold: { fontWeight: "700", color: colors.text },
    enableBtn: {
      backgroundColor: Accent.success, borderRadius: Radius.md,
      paddingVertical: 18, alignItems: "center", alignSelf: "stretch",
      marginTop: Spacing.xxxl,
    },
    enableBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
    skipBtn: { paddingVertical: Spacing.lg },
    skipText: { color: colors.textTertiary, fontSize: 15 },
  }), [colors]);

  // Render nothing until the suppression check resolves so we never
  // flash the explainer for a user who has already responded.
  if (showPrompt !== true) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.badge}>
        <Ionicons name="notifications" size={48} color={Accent.success} />
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>1</Text>
        </View>
      </View>

      <Text style={styles.heading}>Stay on top of your meals</Text>
      <Text style={styles.stat}>
        {
          "We'll send you a gentle nudge to log meals, remind you about your meal plan, and let you know when new recipes match your targets."
        }
      </Text>

      <Pressable style={styles.enableBtn} onPress={() => void onEnable()}>
        <Text style={styles.enableBtnText}>Turn on notifications</Text>
      </Pressable>
      <Pressable style={styles.skipBtn} onPress={() => void onSkip()}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}
