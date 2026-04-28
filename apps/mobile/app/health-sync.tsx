import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "@/hooks/use-safe-back";
import { Ionicons } from "@expo/vector-icons";
import { Footprints, Flame, HeartPulse, Dumbbell, Scale } from "lucide-react-native";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  isExpoGoRuntime,
  isHealthSyncAvailable,
  probeHealthAccess,
  requestDietaryHealthPermissions,
  requestHealthPermissions,
  syncHealthData,
  syncNutritionFromHealth,
} from "@/lib/healthSync";
import { supabase } from "@/lib/supabase";

/** Remember that the user completed Health connect so this screen shows Sync Now after navigation. */
const HEALTH_APPLE_CONNECTED_KEY = "health_sync_apple_connected";

export default function HealthSyncScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)/more");
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [importEnabled, setImportEnabled] = useState(false);
  const [genericImportLabels, setGenericImportLabels] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const available = isHealthSyncAvailable();

  // Persist import/export prefs + whether Apple Health connect completed (UI only).
  // HS-01 (2026-04-28): the cached `health_sync_apple_connected` flag is
  // only trusted as a starting signal — we then probe HealthKit on
  // mount/focus and flip back to disconnected if the bridge errors
  // (user revoked permission in iOS Settings → Privacy → Health →
  // Suppr). Previously the flag was treated as authoritative for the
  // life of the install, so a revoked-then-reopened user kept seeing
  // green "Connected" + "Sync Now" while the integration was dead.
  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const imp = await AsyncStorage.getItem("health_import_nutrition");
        const gen = await AsyncStorage.getItem("health_import_generic_labels");
        const exp = await AsyncStorage.getItem("health_export_nutrition");
        const apple = await AsyncStorage.getItem(HEALTH_APPLE_CONNECTED_KEY);
        if (imp === "true") setImportEnabled(true);
        if (gen === "true") setGenericImportLabels(true);
        if (exp === "true") setExportEnabled(true);
        if (apple === "true") setConnected(true);
      } catch {}
    })();
  }, []);

  // HS-01: re-probe HealthKit access on every focus. If the bridge
  // errors, treat as revoked — clear the cached flag, drop the UI
  // back to "Connect Apple Health". A read returning zero samples is
  // NOT a denial signal (a real user might genuinely have no steps in
  // 24h), so we only act on bridge errors.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const status = await probeHealthAccess();
        if (cancelled) return;
        if (status === "denied") {
          setConnected(false);
          try {
            const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
            await AsyncStorage.removeItem(HEALTH_APPLE_CONNECTED_KEY);
          } catch {}
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // If native never calls back, don’t leave the Connect button spinning when leaving this screen.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setConnecting(false);
      };
    }, []),
  );

  const toggleImport = useCallback(
    async (val: boolean) => {
      setImportEnabled(val);
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.setItem("health_import_nutrition", val ? "true" : "false");
      } catch {}

      if (val && available && connected) {
        const dietary = await requestDietaryHealthPermissions();
        if (!dietary.dietaryImportReady) {
          try {
            const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
            await AsyncStorage.setItem("health_import_nutrition", "false");
          } catch {}
          setImportEnabled(false);
          Alert.alert(
            "Meal import",
            `${dietary.userMessage}${dietary.debugDetail ? `\n\nTechnical detail:\n${dietary.debugDetail}` : ""}`,
            [
              { text: "OK", style: "default" },
              { text: "Open Settings", onPress: () => void Linking.openSettings() },
            ],
          );
        }
      }
    },
    [available, connected],
  );

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
      Alert.alert(
        "Expo Go",
        "Apple Health isn’t available in Expo Go. Open this app from a development build (Xcode or `expo run:ios --device`).",
      );
      return;
    }
    if (!available) {
      Alert.alert(
        "Not available",
        "The Health native module isn’t in this build. From apps/mobile run `npx expo prebuild --platform ios`, then rebuild and install on your iPhone.",
      );
      return;
    }
    setConnecting(true);
    setLastResult(null);
    try {
      const outcome = await requestHealthPermissions();
      if (outcome.ok) {
        setConnected(true);
        try {
          const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
          await AsyncStorage.setItem(HEALTH_APPLE_CONNECTED_KEY, "true");
          // P1-15 (TestFlight `AAcIj2Vc1D60ujE1j76PKLw`, 2026-04-25):
          // tester expectation gap — "Apple Health successfully synced
          // but hasn't pulled in historical meals." The import toggle
          // was opt-in and buried below the connect button. Auto-enable
          // it on first successful connect so the user gets the meal
          // backfill they expect; user can still toggle it off if they
          // don't want it. Idempotent — re-connects don't override an
          // explicit opt-out (tracked by the existing key, written
          // here for the first-time-grant case only).
          const existing = await AsyncStorage.getItem("health_import_nutrition");
          if (existing == null) {
            await AsyncStorage.setItem("health_import_nutrition", "true");
            setImportEnabled(true);
          }
        } catch {
          /* ignore */
        }
        const body = outcome.dietaryImportReady
          ? outcome.userMessage
          : `${outcome.userMessage}${outcome.debugDetail ? `\n\nTechnical detail:\n${outcome.debugDetail}` : ""}`;
        setLastResult(
          outcome.dietaryImportReady
            ? "Health connected. Use Sync Now to pull your latest data."
            : "Health connected with limited permissions. See the alert for details.",
        );
        Alert.alert(outcome.dietaryImportReady ? "Connected" : "Connected (limited)", body, [
          { text: "OK" },
          ...(outcome.ok && !outcome.dietaryImportReady
            ? [{ text: "Open Settings", onPress: () => void Linking.openSettings() }]
            : []),
        ]);
      } else {
        const body = `${outcome.userMessage}${outcome.debugDetail ? `\n\nTechnical detail:\n${outcome.debugDetail}` : ""}`;
        setLastResult("Could not finish Health setup. See the alert for details.");
        Alert.alert("Permission or Health access", body, [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[health-sync] handleConnect", e);
      setLastResult("Something went wrong while connecting to Health.");
      Alert.alert("Health connect failed", msg, [{ text: "OK" }]);
    } finally {
      setConnecting(false);
    }
  }, [available]);

  const handleSync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const result = await syncHealthData(userId);
      const parts: string[] = [];
      if (result.stepsUpdated) parts.push("steps");
      if (result.weightUpdated) parts.push("weight");
      if (result.bodyFatUpdated) parts.push("body fat");
      if (result.activeEnergyUpdated) parts.push("active energy");
      if (result.workoutsUpdated) parts.push("workouts");
      if (result.basalBurnUpdated) parts.push("resting energy");

      let bodyMsg =
        parts.length > 0
          ? `Updated: ${parts.join(", ")}`
          : "No new data to sync";

      if (importEnabled) {
        try {
          const n = await syncNutritionFromHealth(userId, 120);
          const mealLine =
            n.imported.length > 0
              ? `Imported ${n.imported.length} meal${n.imported.length === 1 ? "" : "s"} from Health.`
              : "No new meals to import from Health.";
          bodyMsg = `${bodyMsg} ${mealLine}`;
        } catch {
          const errLine = "Meal import from Health failed.";
          bodyMsg = `${bodyMsg} ${errLine}`;
        }
      }

      setLastResult(bodyMsg.trim());
    } catch {
      setLastResult("Sync failed");
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
        <Pressable onPress={goBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Health Sync</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.card}>
        <CardTitle styles={styles} icon="heart" text="Apple Health / Health Connect" />
        <Text style={styles.desc}>
          Automatically sync your steps, weight, and active energy from Apple Health (iOS) or Google Health Connect (Android). Steps and active energy appear on the Today tab for whichever day you select; water there is from quick-adds plus water logged on foods.
        </Text>

        {/* P1-21 (2026-04-25 design-system-enforcer + Carryover rule
            #2): swap Ionicons for lucide-react-native to match the
            Claude Design prototype's icon language used everywhere else
            in the product. */}
        <View style={{ marginTop: Spacing.lg }}>
          <View style={styles.feature}>
            <Footprints size={20} color={Accent.primary} strokeWidth={1.75} />
            <Text style={styles.featureText}>Daily step count</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={styles.feature}>
            <Scale size={20} color={Accent.primary} strokeWidth={1.75} />
            <Text style={styles.featureText}>Weight measurements</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={styles.feature}>
            <Flame size={20} color={Accent.primary} strokeWidth={1.75} />
            <Text style={styles.featureText}>Active energy burned</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={styles.feature}>
            <HeartPulse size={20} color={Accent.primary} strokeWidth={1.75} />
            <Text style={styles.featureText}>Resting energy burned</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={styles.feature}>
            <Dumbbell size={20} color={Accent.primary} strokeWidth={1.75} />
            <Text style={styles.featureText}>Workouts</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
        </View>
      </View>

      {/* Nutrition export card */}
      <View style={styles.card}>
        <CardTitle styles={styles} icon="nutrition" text="Nutrition Sync" />
        <Text style={styles.desc}>
          {`Share your Suppr meals to Apple Health so other apps can see them. When you tap "Complete Day" on the Today tab, your logged meals are written to Health.`}
        </Text>

        <View style={{ marginTop: Spacing.lg, gap: Spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
              <Ionicons name="download-outline" size={20} color={Accent.primary} />
              <Text style={styles.featureText}>Import meals from Health</Text>
            </View>
            <Switch
              value={importEnabled}
              onValueChange={toggleImport}
              disabled={!available || !connected}
              trackColor={{ true: Accent.primary }}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 28, marginTop: -4 }}>
            Pull dietary energy (and matched macros when available) from other apps into your Today journal. Tap Sync Now after enabling.
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: importEnabled ? 1 : 0.45 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
              <Ionicons name="eye-off-outline" size={20} color={Accent.primary} />
              <Text style={styles.featureText}>Simple labels only (no food names)</Text>
            </View>
            <Switch
              value={genericImportLabels}
              onValueChange={toggleGenericImportLabels}
              disabled={!available || !connected || !importEnabled}
              trackColor={{ true: Accent.primary }}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 28, marginTop: -4 }}>
            Calories, meal time bucket, and macros still come from Health; titles show as Imported food (N kcal) without brand or item names. Clear imported data once if you already synced detailed names.
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
              <Ionicons name="share-outline" size={20} color={Accent.primary} />
              <Text style={styles.featureText}>Share meals to Health</Text>
            </View>
            <Switch
              value={exportEnabled}
              onValueChange={toggleExport}
              disabled={!available || !connected}
              trackColor={{ true: Accent.primary }}
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 28, marginTop: -4 }}>
            Your logged meals will be written to Apple Health for other apps to read
          </Text>
        </View>

        {/* Clear imported data — always visible so user can clean up past imports */}
        <Pressable
          onPress={handleClearImported}
          style={{ alignSelf: "center", marginTop: Spacing.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg }}
        >
          <Text style={{ fontSize: 13, color: Accent.destructive, fontWeight: "600" }}>
            Clear all imported data
          </Text>
        </Pressable>
      </View>

      {!available && (
        <View style={[styles.card, { borderColor: Accent.warning + "40", gap: Spacing.sm }]}>
          <Text style={{ fontSize: 14, color: Accent.warning, fontWeight: "600" }}>
            {isExpoGoRuntime()
              ? "Apple Health isn’t available in Expo Go."
              : "Apple Health isn’t available in this install."}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            {isExpoGoRuntime()
              ? "Install the Suppr development build (not the Expo Go app), then return here."
              : "Rebuild with native modules: from apps/mobile run `npx expo prebuild --platform ios`, open ios/Suppr.xcworkspace, build to your iPhone, and start Metro (`npx expo start` or `npm run ios:device:tunnel`)."}
          </Text>
        </View>
      )}

      {!connected ? (
        <Pressable
          style={[styles.btn, { backgroundColor: available && !connecting ? Accent.primary : colors.textTertiary }]}
          onPress={handleConnect}
          disabled={!available || connecting}
        >
          {connecting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Connect Health Data</Text>
          )}
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