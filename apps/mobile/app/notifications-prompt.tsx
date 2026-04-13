import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Neon, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export default function NotificationsPromptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();

  async function onEnable() {
    try {
      const Notifications = await import("expo-notifications");
      const { status } = await Notifications.requestPermissionsAsync();
      console.log("[notifications] permission:", status);
    } catch {
      // module not available in this build or permission denied
    }
    router.replace("/(tabs)/discover");
  }

  function onSkip() {
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
      backgroundColor: Neon.green + "15",
      justifyContent: "center", alignItems: "center",
      marginBottom: Spacing.xl,
    },
    notifBadge: {
      position: "absolute", top: 0, right: 0,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: Neon.red, justifyContent: "center", alignItems: "center",
    },
    notifBadgeText: { color: "#fff", fontSize: 14, fontWeight: "800" },
    heading: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", lineHeight: 30 },
    stat: {
      fontSize: 15, color: colors.textSecondary, textAlign: "center",
      marginTop: Spacing.xl, lineHeight: 22, paddingHorizontal: Spacing.lg,
    },
    statBold: { fontWeight: "700", color: colors.text },
    enableBtn: {
      backgroundColor: Neon.green, borderRadius: Radius.md,
      paddingVertical: 18, alignItems: "center", alignSelf: "stretch",
      marginTop: Spacing.xxxl,
    },
    enableBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
    skipBtn: { paddingVertical: Spacing.lg },
    skipText: { color: colors.textTertiary, fontSize: 15 },
  }), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.badge}>
        <Ionicons name="notifications" size={48} color={Neon.green} />
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>1</Text>
        </View>
      </View>

      <Text style={styles.heading}>Stay on top of your meals</Text>
      <Text style={styles.stat}>
        We'll send you a gentle nudge to log meals, remind you about your meal plan,
        and let you know when new recipes match your targets.
      </Text>

      <Pressable style={styles.enableBtn} onPress={() => void onEnable()}>
        <Text style={styles.enableBtnText}>Turn on notifications</Text>
      </Pressable>
      <Pressable style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>No thanks</Text>
      </Pressable>
    </View>
  );
}
