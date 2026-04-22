import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "@/hooks/use-safe-back";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  isExpoGoRuntime,
  isHealthSyncAvailable,
  requestHealthPermissions,
  syncHealthData,
  syncNutritionFromHealth,
} from "@/lib/healthSync";
import { supabase } from "@/lib/supabase";

export default function HealthSyncScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)/more");
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();

  const [connected, setConnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [importEnabled, setImportEnabled] = useState(false);
  const [genericImportLabels, setGenericImportLabels] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const available = isHealthSyncAvailable();

  // Persist import/export prefs
  useEffect(() => {
    (async () => {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const imp = await AsyncStorage.getItem("health_import_nutrition");
        const gen = await AsyncStorage.getItem("health_import_generic_labels");
        const exp = await AsyncStorage.getItem("health_export_nutrition");
        if (imp === "true") setImportEnabled(true);
        if (gen === "true") setGenericImportLabels(true);
        if (exp === "true") setExportEnabled(true);
      } catch {}
    })();
  }, []);

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
    // F-1 (2026-04-19): belt-and-suspenders top-level try/catch so a
    // native-bridge throw on iOS 26.5 cannot take the app down from this
    // tap. `requestHealthPermissions` is itself wrapped in try/catch and
    // should only ever resolve `true | false`, never reject — but this
    // handler is the most likely crash surface reported by testers, so we
    // guard it here too and surface a user-visible recovery path.
    try {
      const granted = await requestHealthPermissions();
      if (granted) {
        setConnected(true);
        Alert.alert("Connected", "Health data sync is now enabled.");
      } else {
        // F-26 (2026-04-21): shorter, clearer recovery path (AG-5oy-1vqo7).
        // F-35 (2026-04-21): add the "not listed" fallback. TestFlight
        // AAUjI8ZWEQKi — tester followed the F-26 instruction, went to
        // Settings → Health → Data Access & Devices, but Suppr wasn't
        // listed. That happens when the iOS auth sheet didn't actually
        // present (permission denied path, not permission granted path);
        // Apple only adds an app to that list once auth has been
        // requested *and* the sheet rendered. Recovery: force-quit and
        // relaunch so the next Connect tap triggers the sheet fresh.
        Alert.alert(
          "Health access needed",
          "Open Settings → Health → Data Access & Devices → Suppr and turn the switches on, then try Connect again.\n\nIf Suppr isn’t listed there yet, force-quit Suppr (swipe up and close it), reopen, and tap Connect again — the Apple Health prompt should appear.",
        );
      }
    } catch {
      Alert.alert(
        "Couldn’t connect",
        "Something went wrong talking to Apple Health. We’ve logged the error — please try again in a moment.",
      );
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
          // F-44 (2026-04-22): widen the default lookback so first-
          // connect users get an MFP/LoseIt-style historical import
          // (2 years) instead of only the last 4 months. Subsequent
          // syncs still read the same full window — Postgres dedupe
          // via `health_sample_id` keeps re-imports idempotent.
          const n = await syncNutritionFromHealth(userId, 730);
          // F-62 (2026-04-22): TestFlight build-28 ABG0cZzo + AELbM8VJ
          // ("says no meals to import but there are meals to import").
          // The previous single copy line flattened three distinct
          // states into one confusing "no new meals" message:
          //   (a) HealthKit returned nothing readable → denied perms
          //       or genuinely empty (handled by the F-57 Alert below);
          //   (b) HealthKit returned rows but all were Suppr-authored
          //       — already our own data, nothing to import back;
          //   (c) HealthKit returned rows but they were already
          //       covered by a prior import (dedupe).
          // Distinguish so the tester knows what the sync actually did.
          let mealLine: string;
          if (n.imported.length > 0) {
            mealLine = `Imported ${n.imported.length} meal${n.imported.length === 1 ? "" : "s"} from Health.`;
          } else if (n.skippedOwn > 0) {
            mealLine = `No new external meals to import — ${n.skippedOwn} sample${n.skippedOwn === 1 ? "" : "s"} skipped (already logged in Suppr).`;
          } else {
            mealLine = "No new meals to import from Health.";
          }
          bodyMsg = `${bodyMsg} ${mealLine}`;

          // F-57 (2026-04-22): TestFlight build-28 AEzcUFvXt / AEWQ5gs3 /
          // AAcIj2Vc — sync succeeds (body data pulls) but 0 historical
          // meals pull in, and "it used to work". Most likely cause: iOS
          // silently suppresses a re-prompt for dietary read perms once
          // a prior version asked for them, so HKHealthStore returns
          // zero food correlations even when the user thinks they
          // granted perms. Apple's API offers no way to query read
          // status. We detect "body moved + dietary empty + no skipped-
          // own" as a proxy and surface a recovery Alert with a
          // direct link into the Health app, where the user can toggle
          // Suppr's dietary read permissions manually under Sharing →
          // Apps and Services → Suppr.
          const bodyMovedSomething =
            result.stepsUpdated ||
            result.activeEnergyUpdated ||
            result.workoutsUpdated ||
            result.basalBurnUpdated;
          const dietaryLooksDenied =
            n.imported.length === 0 && n.skippedOwn === 0 && bodyMovedSomething;
          if (dietaryLooksDenied) {
            Alert.alert(
              "Meals not importing from Health",
              "Body data synced, but Apple Health didn’t return any food entries. This usually means read permission for Nutrition is off for Suppr.\n\nOpen Health → Sharing → Apps and Services → Suppr, then turn on all Nutrition categories.",
              [
                { text: "Not now", style: "cancel" },
                {
                  text: "Open Health",
                  onPress: () => {
                    Linking.openURL("x-apple-health://").catch(() => {
                      Alert.alert(
                        "Couldn’t open Health",
                        "Open the Health app manually, then Sharing → Apps and Services → Suppr.",
                      );
                    });
                  },
                },
              ],
            );
          }
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
          <View style={styles.feature}>
            <Ionicons name="flame-outline" size={20} color={Accent.primary} />
            <Text style={styles.featureText}>Active energy burned</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={styles.feature}>
            <Ionicons name="bed-outline" size={20} color={Accent.primary} />
            <Text style={styles.featureText}>Resting energy burned</Text>
            <Ionicons name={connected ? "checkmark-circle" : "ellipse-outline"} size={20} color={connected ? Accent.success : colors.textTertiary} />
          </View>
          <View style={styles.feature}>
            <Ionicons name="barbell-outline" size={20} color={Accent.primary} />
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

        {/* F-57 (2026-04-22): always-visible Troubleshoot link that
            opens the iOS Health app. Gives the user a one-tap path to
            toggle Suppr's dietary read permissions when iOS won't
            re-present the auth sheet (see handleSync for why). */}
        <Pressable
          onPress={() => {
            Linking.openURL("x-apple-health://").catch(() => {
              Alert.alert(
                "Couldn’t open Health",
                "Open the Health app manually, then Sharing → Apps and Services → Suppr.",
              );
            });
          }}
          style={{ alignSelf: "center", marginTop: Spacing.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg }}
        >
          <Text style={{ fontSize: 13, color: Accent.primary, fontWeight: "600" }}>
            Open Health app · Manage permissions
          </Text>
        </Pressable>

        {/* Clear imported data — always visible so user can clean up past imports */}
        <Pressable
          onPress={handleClearImported}
          style={{ alignSelf: "center", marginTop: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg }}
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
