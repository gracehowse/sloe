import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "@/hooks/use-safe-back";
import { ChevronLeft, HeartPulse, Footprints, Scale, Flame, Dumbbell, ChevronRight } from "lucide-react-native";
import { Accent, Spacing, Radius, MacroColors } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  isExpoGoRuntime,
  isHealthSyncAvailable,
  requestHealthPermissions,
  syncHealthData,
  syncNutritionFromHealth,
  persistHealthLastValues,
  loadHealthLastValues,
  type HealthLastValues,
} from "@/lib/healthSync";
import { supabase } from "@/lib/supabase";
import { HealthStatusPill, type HealthConnectionState } from "@/components/health/HealthStatusPill";
import { HealthDataRow } from "@/components/health/HealthDataRow";

export default function HealthSyncScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)/more");
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();

  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [importEnabled, setImportEnabled] = useState(false);
  const [genericImportLabels, setGenericImportLabels] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const [lastValues, setLastValues] = useState<HealthLastValues | null>(null);
  const [needsAttention, setNeedsAttention] = useState(false);
  const available = isHealthSyncAvailable();

  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const [conn, imp, gen, exp] = await Promise.all([
          AsyncStorage.getItem("health_connected"),
          AsyncStorage.getItem("health_import_nutrition"),
          AsyncStorage.getItem("health_import_generic_labels"),
          AsyncStorage.getItem("health_export_nutrition"),
        ]);
        if (conn === "true") setConnected(true);
        if (imp === "true") setImportEnabled(true);
        if (gen === "true") setGenericImportLabels(true);
        if (exp === "true") setExportEnabled(true);
      } catch {}
      const vals = await loadHealthLastValues();
      if (vals) {
        setLastValues(vals);
        if (vals.syncedAt) setLastSyncAt(vals.syncedAt);
      }
    })();
  }, []);

  const pillState: HealthConnectionState = !connected
    ? "disconnected"
    : needsAttention
      ? "attention"
      : "connected";

  const statusSubtext = useMemo(() => {
    if (!connected)
      return "Connect to let Suppr read your steps, weight, energy and workouts from Apple Health. You choose what's shared in the next screen.";
    if (!lastSyncAt)
      return "Connected. Tap Sync now to pull your latest data.";
    const diff = Date.now() - new Date(lastSyncAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return "Last synced just now. Tap Sync now to refresh.";
    if (mins < 60) return `Last synced ${mins} min ago. Tap Sync now to refresh.`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Last synced ${hrs}h ago. Tap Sync now to refresh.`;
    return `Last synced ${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) === 1 ? "" : "s"} ago. Tap Sync now to refresh.`;
  }, [connected, lastSyncAt]);

  const toggleImport = useCallback(async (val: boolean) => {
    setImportEnabled(val);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("health_import_nutrition", val ? "true" : "false");
    } catch {}
  }, []);

  const toggleExport = useCallback(async (val: boolean) => {
    setExportEnabled(val);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("health_export_nutrition", val ? "true" : "false");
    } catch {}
  }, []);

  const toggleGenericImportLabels = useCallback(async (val: boolean) => {
    setGenericImportLabels(val);
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem("health_import_generic_labels", val ? "true" : "false");
    } catch {}
  }, []);

  const handleConnect = useCallback(async () => {
    if (isExpoGoRuntime()) {
      Alert.alert("Expo Go", "Apple Health isn't available in Expo Go. Open this app from a development build.");
      return;
    }
    if (!available) {
      Alert.alert("Not available", "The Health native module isn't in this build.");
      return;
    }
    try {
      const granted = await requestHealthPermissions();
      if (granted) {
        setConnected(true);
        try {
          const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
          await AsyncStorage.setItem("health_connected", "true");
        } catch {}
        Alert.alert("Connected", "Health data sync is now enabled.");
      } else {
        Alert.alert(
          "Health access needed",
          "Open Settings → Health → Data Access & Devices → Suppr and turn the switches on, then try Connect again.\n\nIf Suppr isn't listed there yet, force-quit Suppr, reopen, and tap Connect again — the Apple Health prompt should appear.",
        );
      }
    } catch {
      Alert.alert("Couldn't connect", "Something went wrong talking to Apple Health. Please try again in a moment.");
    }
  }, [available]);

  const handleSync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const result = await syncHealthData(userId);

      let dietaryLooksDenied = false;

      if (importEnabled) {
        try {
          const n = await syncNutritionFromHealth(userId, 730);

          let mealLine: string;
          if (n.imported.length > 0) {
            mealLine = `Imported ${n.imported.length} meal${n.imported.length === 1 ? "" : "s"} from Health.`;
          } else if (n.skippedOwn > 0) {
            mealLine = `No new external meals — ${n.skippedOwn} sample${n.skippedOwn === 1 ? "" : "s"} skipped (already in Suppr).`;
          } else {
            mealLine = "No new meals to import from Health.";
          }

          const bodyMovedSomething =
            result.stepsUpdated || result.activeEnergyUpdated || result.workoutsUpdated || result.basalBurnUpdated;
          dietaryLooksDenied = n.imported.length === 0 && n.skippedOwn === 0 && bodyMovedSomething;

          if (dietaryLooksDenied) {
            setNeedsAttention(true);
            Alert.alert(
              "Meals not importing from Health",
              "Body data synced, but Apple Health didn't return any food entries. This usually means read permission for Nutrition is off for Suppr.\n\nOpen Health → Sharing → Apps and Services → Suppr, then turn on all Nutrition categories.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Open Health",
                  onPress: () => Linking.openURL("x-apple-health://").catch(() =>
                    Alert.alert("Couldn't open Health", "Open the Health app manually.")
                  ),
                },
              ],
            );
          } else {
            setNeedsAttention(false);
          }

          Alert.alert("Synced", mealLine);
        } catch {
          Alert.alert("Sync issue", "Meal import from Health failed. Body data may still have updated.");
        }
      } else {
        const parts: string[] = [];
        if (result.stepsUpdated) parts.push("steps");
        if (result.weightUpdated) parts.push("weight");
        if (result.activeEnergyUpdated) parts.push("active energy");
        if (result.basalBurnUpdated) parts.push("resting energy");
        if (result.workoutsUpdated) parts.push("workouts");
        Alert.alert("Synced", parts.length > 0 ? `Updated: ${parts.join(", ")}.` : "No new data to sync.");
      }

      const now = new Date().toISOString();
      setLastSyncAt(now);
      if (userId) {
        await persistHealthLastValues(userId);
        const vals = await loadHealthLastValues();
        if (vals) setLastValues(vals);
      }
    } catch {
      Alert.alert("Sync failed", "Something went wrong. Please try again.");
    } finally {
      setSyncing(false);
    }
  }, [userId, importEnabled]);

  const handleClearImported = useCallback(() => {
    if (!userId) return;
    Alert.alert(
      "Clear imported data",
      "This will delete all nutrition entries imported from Apple Health. Your manually logged meals won't be affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            const { error, count } = await supabase
              .from("nutrition_entries")
              .delete({ count: "exact" })
              .eq("user_id", userId)
              .eq("source", "apple_health");
            if (error) {
              Alert.alert("Error", "Could not clear imported data.");
            } else {
              Alert.alert("Done", `Removed ${count ?? 0} imported entr${count === 1 ? "y" : "ies"}.`);
            }
          },
        },
      ],
    );
  }, [userId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
        title: { flex: 1, fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
        sectionHeader: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          marginLeft: Spacing.xl,
          marginBottom: Spacing.sm,
        },
        card: {
          marginHorizontal: Spacing.xl,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          marginBottom: Spacing.lg,
        },
        statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        statusTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
        statusSubtext: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginTop: Spacing.sm },
        ctaBtn: {
          marginTop: Spacing.lg,
          paddingVertical: 14,
          borderRadius: Radius.md,
          alignItems: "center",
          backgroundColor: Accent.primary,
        },
        ctaBtnDisabled: { backgroundColor: colors.textTertiary },
        ctaBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
        dataFooter: { fontSize: 11, color: colors.textTertiary, marginTop: 10, lineHeight: 16 },
        switchRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: Spacing.sm,
        },
        switchLabel: { fontSize: 15, color: colors.text, flex: 1 },
        utilRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
        },
        utilText: { fontSize: 15, color: colors.text },
        utilTextDestructive: { fontSize: 15, color: Accent.destructive },
      }),
    [colors],
  );

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 48 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Health Sync</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* A. Connection status card */}
      <Text style={[styles.sectionHeader, { marginBottom: Spacing.sm }]}>APPLE HEALTH</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <HeartPulse size={20} color={Accent.primary} />
            <Text style={styles.statusTitle}>Apple Health</Text>
          </View>
          <HealthStatusPill state={pillState} />
        </View>
        <Text style={styles.statusSubtext}>{statusSubtext}</Text>

        {needsAttention && (
          <Pressable
            onPress={() => Linking.openURL("x-apple-health://").catch(() => {})}
            style={{ marginTop: Spacing.sm }}
          >
            <Text style={{ fontSize: 13, color: Accent.primary, fontWeight: "600" }}>Open Health app →</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.ctaBtn, !available && styles.ctaBtnDisabled]}
          onPress={connected ? handleSync : handleConnect}
          disabled={!available || syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaBtnText}>{connected ? "Sync now" : "Connect Apple Health"}</Text>
          )}
        </Pressable>
      </View>

      {/* B. What Suppr reads */}
      <Text style={styles.sectionHeader}>WHAT SUPPR READS FROM HEALTH</Text>
      <View style={styles.card}>
        <HealthDataRow
          icon={Footprints}
          tint={colors.textSecondary}
          label="Steps"
          value={lastValues?.steps}
          isFirst
        />
        <HealthDataRow
          icon={Scale}
          tint={MacroColors.protein}
          label="Weight"
          value={lastValues?.weight}
        />
        <HealthDataRow
          icon={Flame}
          tint={MacroColors.carbs}
          label="Active energy"
          value={lastValues?.activeEnergy}
        />
        <HealthDataRow
          icon={HeartPulse}
          tint={MacroColors.fat}
          label="Resting energy"
          value={lastValues?.restingEnergy}
        />
        <HealthDataRow
          icon={Dumbbell}
          tint={Accent.primary}
          label="Workouts"
          value={lastValues?.workouts}
        />
        <Text style={styles.dataFooter}>
          Values update each time you tap Sync now. If a row stays blank, that category&apos;s read permission is off in the Health app.
        </Text>
      </View>

      {/* C. Nutrition Sync */}
      <Text style={styles.sectionHeader}>NUTRITION SYNC</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Import meals from Health</Text>
          <Switch
            value={importEnabled}
            onValueChange={toggleImport}
            disabled={!available || !connected}
            trackColor={{ true: Accent.primary }}
          />
        </View>
        {importEnabled && (
          <>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: Spacing.sm }}>
              Pulls dietary energy and macros from other apps into your Today journal. Tap Sync now after enabling.
            </Text>
            <View style={[styles.switchRow, { marginLeft: Spacing.lg }]}>
              <Text style={[styles.switchLabel, { fontSize: 14 }]}>Simple labels only</Text>
              <Switch
                value={genericImportLabels}
                onValueChange={toggleGenericImportLabels}
                disabled={!available || !connected}
                trackColor={{ true: Accent.primary }}
              />
            </View>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: Spacing.lg }}>
              Shows &ldquo;Imported food (N kcal)&rdquo; instead of food names.
            </Text>
          </>
        )}
        <View style={[styles.switchRow, { marginTop: importEnabled ? Spacing.md : 0 }]}>
          <Text style={styles.switchLabel}>Share meals to Health</Text>
          <Switch
            value={exportEnabled}
            onValueChange={toggleExport}
            disabled={!available || !connected}
            trackColor={{ true: Accent.primary }}
          />
        </View>
        {exportEnabled && (
          <Text style={{ fontSize: 12, color: colors.textTertiary }}>
            Your logged meals are written to Apple Health when you complete your day.
          </Text>
        )}
      </View>

      {/* D. Utilities */}
      <Text style={styles.sectionHeader}>MANAGE</Text>
      <View style={styles.card}>
        <Pressable
          style={[styles.utilRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
          onPress={() =>
            Linking.openURL("x-apple-health://").catch(() =>
              Alert.alert("Couldn't open Health", "Open the Health app manually, then Sharing → Apps and Services → Suppr.")
            )
          }
        >
          <Text style={styles.utilText}>Open Health app · Manage permissions</Text>
          <ChevronRight size={16} color={colors.textTertiary} />
        </Pressable>
        <Pressable style={styles.utilRow} onPress={handleClearImported}>
          <Text style={styles.utilTextDestructive}>Clear imported data…</Text>
          <ChevronRight size={16} color={Accent.destructive + "80"} />
        </Pressable>
      </View>

      {!available && (
        <View style={[styles.card, { borderColor: Accent.warning + "40", gap: Spacing.sm }]}>
          <Text style={{ fontSize: 14, color: Accent.warning, fontWeight: "600" }}>
            {isExpoGoRuntime() ? "Apple Health isn't available in Expo Go." : "Apple Health isn't available in this install."}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            {isExpoGoRuntime()
              ? "Install the Suppr development build, then return here."
              : "Rebuild with native modules: `npx expo prebuild --platform ios`, then rebuild in Xcode."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
