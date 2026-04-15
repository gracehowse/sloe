import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isHealthSyncAvailable, requestHealthPermissions, syncHealthData } from "@/lib/healthSync";

export default function HealthSyncScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();

  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const available = isHealthSyncAvailable();

  const handleConnect = useCallback(async () => {
    const granted = await requestHealthPermissions();
    if (granted) {
      setConnected(true);
      Alert.alert("Connected", "Health data sync is now enabled.");
    } else {
      Alert.alert("Unavailable", "Health sync requires a native build. This feature is not available in Expo Go.");
    }
  }, []);

  const handleSync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const result = await syncHealthData(userId);
      const parts: string[] = [];
      if (result.stepsUpdated) parts.push("steps");
      if (result.weightUpdated) parts.push("weight");
      setLastResult(
        parts.length > 0
          ? `Updated: ${parts.join(", ")}`
          : "No new data to sync",
      );
    } catch {
      setLastResult("Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
        title: { flex: 1, fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
        card: {
          marginHorizontal: Spacing.xl,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          marginBottom: Spacing.lg,
        },
        cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: Spacing.sm },
        desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
        btn: {
          marginHorizontal: Spacing.xl,
          paddingVertical: 16,
          borderRadius: Radius.md,
          alignItems: "center",
          marginBottom: Spacing.lg,
        },
        btnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
        feature: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
        featureText: { fontSize: 14, color: colors.text, flex: 1 },
      }),
    [colors],
  );

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Health Sync</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.card}>
        <CardTitle styles={styles} icon="heart" text="Apple Health / Health Connect" />
        <Text style={styles.desc}>
          Automatically sync your steps, weight, and activity data from Apple Health (iOS) or Google Health Connect (Android).
        </Text>

        <View style={{ marginTop: Spacing.lg }}>
          <View style={styles.feature}>
            <Ionicons name="footsteps-outline" size={20} color={Accent.primary} />
            <Text style={styles.featureText}>Daily step count</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={styles.feature}>
            <Ionicons name="scale-outline" size={20} color={Accent.primary} />
            <Text style={styles.featureText}>Weight measurements</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={[styles.feature, { opacity: 0.5 }]}>
            <Ionicons name="flame-outline" size={20} color={Accent.primary} />
            <Text style={styles.featureText}>Active energy burned</Text>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary }}>Coming soon</Text>
          </View>
        </View>
      </View>

      {!available && (
        <View style={[styles.card, { borderColor: Accent.warning + "40", gap: Spacing.sm }]}>
          <Text style={{ fontSize: 14, color: Accent.warning, fontWeight: "600" }}>
            Health sync needs a dev or production build — not Expo Go.
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            Configure EAS for this app, run a development build for iOS or Android, install it on a real device, then open this screen again to grant Health permissions.
          </Text>
        </View>
      )}

      {!connected ? (
        <Pressable
          style={[styles.btn, { backgroundColor: available ? Accent.primary : colors.textTertiary }]}
          onPress={handleConnect}
          disabled={!available}
        >
          <Text style={styles.btnText}>Connect Health Data</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.btn, { backgroundColor: Accent.primary }]}
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Sync Now</Text>
          )}
        </Pressable>
      )}

      {lastResult && (
        <Text style={{ textAlign: "center", fontSize: 13, color: colors.textSecondary, marginTop: -Spacing.sm }}>
          {lastResult}
        </Text>
      )}
    </ScrollView>
  );
}

function CardTitle({ styles, icon, text }: { styles: any; icon: string; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <Ionicons name={icon as any} size={20} color={Accent.primary} />
      <Text style={styles.cardTitle}>{text}</Text>
    </View>
  );
}
