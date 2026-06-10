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
import { X } from "lucide-react-native";
import { Accent, Spacing, Radius, Type } from "@/constants/theme";
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
          // Activation hook (audit 2026-04-30): land on Today, not
          // Discover. Post-Reveal momentum was being killed by a wall
          // of strangers' recipes; Today preserves the aha by anchoring
          // the user on their freshly-built ring + library.
          router.replace("/(tabs)?firstRun=1");
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
          "You can turn them on any time in Settings → Sloe → Notifications.",
          [
            { text: "Skip", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
      }
    } catch {
      Alert.alert(
        "Not available here",
        "System notifications require a full Sloe install (not Expo Go).",
      );
    }
    // Whether the user granted, denied, or hit a missing-native-module
    // path, the prompt has done its job. Suppress it so we never re-nag.
    await markNotificationsPromptDismissed();
    // Activation hook (audit 2026-04-30): land on Today, not Discover.
    // After the Reveal moment we want momentum on the user's own ring,
    // not a wall of strangers' recipes.
    router.replace("/(tabs)?firstRun=1");
  }

  async function onSkip() {
    // Skip is an informed decision — also suppress, so a deliberate
    // "no" doesn't re-prompt on every launch.
    await markNotificationsPromptDismissed();
    // Activation hook (audit 2026-04-30): see `onEnable` — Today, not
    // Discover.
    router.replace("/(tabs)?firstRun=1");
  }

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.background,
      justifyContent: "center", alignItems: "center",
      paddingHorizontal: Spacing.xxl,
    },
    // Audit 2026-04-30: top-right escape hatch. The screen runs with
    // `headerShown: false`, so without this X the user has zero way to
    // back out without engaging with the prompt — first-time users
    // perceived this as forced enrolment.
    closeBtn: {
      position: "absolute",
      right: Spacing.xl,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
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
    heading: { ...Type.title, color: colors.text, textAlign: "center" },
    stat: {
      fontSize: 15, color: colors.textSecondary, textAlign: "center",
      marginTop: Spacing.xl, lineHeight: 22, paddingHorizontal: Spacing.lg,
    },
    statBold: { fontWeight: "700", color: colors.text },
    bullets: {
      alignSelf: "stretch",
      marginTop: Spacing.xl,
      gap: Spacing.md,
    },
    enableBtn: {
      backgroundColor: Accent.success, borderRadius: Radius.md,
      paddingVertical: 18, alignItems: "center", alignSelf: "stretch",
      marginTop: Spacing.xxxl,
    },
    enableBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
    // Audit 2026-04-30: was tiny tertiary text reading "Skip" — looked
    // ignorable and didn't communicate persistence. Now sized closer to
    // the primary CTA with honest "Maybe later" copy.
    skipBtn: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      marginTop: Spacing.sm,
    },
    skipText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: "600",
    },
  }), [colors]);

  // Render nothing until the suppression check resolves so we never
  // flash the explainer for a user who has already responded.
  if (showPrompt !== true) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Audit 2026-04-30: visible escape hatch. Routes to /(tabs) and
          marks the prompt as dismissed, mirroring `onSkip`. */}
      <Pressable
        style={[styles.closeBtn, { top: insets.top + Spacing.md }]}
        onPress={() => void onSkip()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
      >
        <X size={20} color={colors.textSecondary} strokeWidth={2.25} />
      </Pressable>

      <View style={styles.badge}>
        <Ionicons name="notifications" size={48} color={Accent.success} />
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>1</Text>
        </View>
      </View>

      <Text style={styles.heading}>Stay on top of your meals</Text>

      {/* 2026-05-12 (premium-bar audit #13, Cal AI pattern): single-line
          explainer expanded into a 3-bullet value ladder. Bullets make
          the commitment concrete ("evening nudge", "Sunday recap") and
          the trust line ("two max per week") sets expectation for
          "we won't spam you" — important for an opt-in moment. */}
      <View style={styles.bullets}>
        <BulletRow
          colors={colors}
          icon="moon-outline"
          title="Evening nudge"
          sub="A quiet poke if you're off your daily target."
        />
        <BulletRow
          colors={colors}
          icon="newspaper-outline"
          title="Sunday weekly recap"
          sub="Where the week landed in numbers — no judgment, just the data."
        />
        <BulletRow
          colors={colors}
          icon="checkmark-circle-outline"
          title="Two nudges a week, max"
          sub="That's the cap for these nudges — no marketing, no surprises."
        />
      </View>

      <Pressable style={styles.enableBtn} onPress={() => void onEnable()}>
        <Text style={styles.enableBtnText}>Turn on notifications</Text>
      </Pressable>
      <Pressable style={styles.skipBtn} onPress={() => void onSkip()}>
        <Text style={styles.skipText}>Maybe later</Text>
      </Pressable>
    </View>
  );
}

function BulletRow({
  colors,
  icon,
  title,
  sub,
}: {
  colors: ReturnType<typeof useThemeColors>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingHorizontal: Spacing.md,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: Accent.success + "15",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        <Ionicons name={icon} size={18} color={Accent.success} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 }}>
          {sub}
        </Text>
      </View>
    </View>
  );
}
