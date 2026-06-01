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
import { useSettingsWinMoment } from "@/hooks/useSettingsWinMoment";
import {
  isExpoGoRuntime,
  isHealthSyncAvailable,
  probeHealthAccess,
  probeNutritionWrite,
  requestDietaryHealthPermissions,
  requestHealthPermissions,
  syncHealthData,
  syncNutritionFromHealth,
} from "@/lib/healthSync";
import { supabase } from "@/lib/supabase";

/** Remember that the user completed Health connect so this screen shows Sync Now after navigation. */
const HEALTH_APPLE_CONNECTED_KEY = "health_sync_apple_connected";

/**
 * 2026-05-14 (premium-bar audit Group J #9): per-category last-sync
 * timestamps. Persisted to AsyncStorage on every successful `syncHealthData`
 * call (one key per category). Reads back into local state on mount + focus
 * so the rows always reflect what was last pulled.
 */
type HealthCategoryKey = "steps" | "weight" | "active_energy" | "resting_energy" | "workouts";
const LAST_SYNC_KEYS: Record<HealthCategoryKey, string> = {
  steps: "health_sync_last_steps_at",
  weight: "health_sync_last_weight_at",
  active_energy: "health_sync_last_active_energy_at",
  resting_energy: "health_sync_last_resting_energy_at",
  workouts: "health_sync_last_workouts_at",
};

/** Render-friendly "Synced 3 min ago" / "Synced just now" / "Never synced". */
function formatLastSync(iso: string | null): string {
  if (!iso) return "Never synced";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Never synced";
  const diffMs = Date.now() - t;
  if (diffMs < 0) return "Synced just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "Synced just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Synced ${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Synced ${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `Synced ${day} day${day === 1 ? "" : "s"} ago`;
  return `Synced ${new Date(iso).toLocaleDateString()}`;
}

export default function HealthSyncScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)/settings");
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();
  // ENG-824 — quiet win-moment (success haptic + win-colour wash on the Apple
  // Health card) the first time a connect succeeds. Gated behind
  // `redesign_winmoment`; inert when off.
  const winMoment = useSettingsWinMoment();

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [importEnabled, setImportEnabled] = useState(false);
  const [genericImportLabels, setGenericImportLabels] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const available = isHealthSyncAvailable();

  // 2026-05-14 (premium-bar audit Group J #9): per-category last-sync
  // timestamps. Loaded from AsyncStorage on mount/focus; persisted in
  // `handleSync` after a successful raceHealth run. `null` means the
  // category has never been synced on this device — the row renders
  // "Never synced" rather than blanking out the timestamp slot.
  const [lastSyncTimes, setLastSyncTimes] = useState<Record<HealthCategoryKey, string | null>>({
    steps: null,
    weight: null,
    active_energy: null,
    resting_energy: null,
    workouts: null,
  });

  // F-57 follow-up (Build 41, 2026-05-01) — persistent error state
  // with recovery affordances. Previously a connect/sync failure left
  // the user with only a dismissed Alert + a one-line "Sync failed"
  // text. Grace re-flagged "same apple health error message" on
  // TestFlight `ALlGgnDVP-rzqUojRWknayY` (2026-04-23) — same message,
  // no obvious next step. We now show an inline banner with two
  // affordances: "Try again" (re-runs whichever flow failed) and
  // "Open iOS Settings" (deep-links to Settings → Privacy → Health
  // → Suppr where the user can grant or re-grant permissions).
  type HealthErrorKind = "connect" | "sync" | null;
  const [errorState, setErrorState] = useState<{
    kind: HealthErrorKind;
    message: string;
  } | null>(null);

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
        // 2026-05-14 (premium-bar audit Group J #9): hydrate per-category
        // last-sync timestamps. Each value is an ISO string (or null).
        const entries = await Promise.all(
          (Object.keys(LAST_SYNC_KEYS) as HealthCategoryKey[]).map(async (k) => {
            const v = await AsyncStorage.getItem(LAST_SYNC_KEYS[k]);
            return [k, v] as const;
          }),
        );
        const next: Record<HealthCategoryKey, string | null> = {
          steps: null,
          weight: null,
          active_energy: null,
          resting_energy: null,
          workouts: null,
        };
        for (const [k, v] of entries) {
          if (v && typeof v === "string") next[k] = v;
        }
        setLastSyncTimes(next);
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
    setErrorState(null);
    try {
      const outcome = await requestHealthPermissions();
      if (outcome.ok) {
        setConnected(true);
        // ENG-824 — landmark: a fresh successful Health connect. Quiet success
        // haptic + win-colour wash on the card (no full-screen win-moment;
        // that's reserved for Today landmarks). No-op when the flag is off.
        winMoment.celebrate();
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
          // Audit/2026-04-30 — match the read posture for write too:
          // default ON on first connect (parity with MFP / Cal AI).
          // User can still toggle off in Settings → Health Sync; the
          // explicit opt-out is preserved (existing != null).
          const existingExport = await AsyncStorage.getItem("health_export_nutrition");
          if (existingExport == null) {
            await AsyncStorage.setItem("health_export_nutrition", "true");
            setExportEnabled(true);
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
        setErrorState({
          kind: "connect",
          message: outcome.userMessage || "We couldn't finish setting up Apple Health.",
        });
        Alert.alert("Permission or Health access", body, [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => void Linking.openSettings() },
        ]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[health-sync] handleConnect", e);
      setLastResult("Something went wrong while connecting to Health.");
      setErrorState({
        kind: "connect",
        message: "Something went wrong while connecting to Apple Health.",
      });
      Alert.alert("Health connect failed", msg, [{ text: "OK" }]);
    } finally {
      setConnecting(false);
    }
  }, [available, winMoment]);

  // Debug audit 2026-05-04 (code-quality #9): the HealthKit calls had
  // no timeout. A native-bridge hang (HealthKit deadlock on a flaky
  // build) left `setSyncing(true)` stuck and the user locked out of
  // the action until app restart with a spinning button forever.
  // 18s race matches the pattern used elsewhere (`raceJournal`); on
  // timeout we surface the same error UI the catch branch uses.
  const HEALTH_CALL_TIMEOUT_MS = 18_000;
  const healthSyncTimeoutSentinel = Symbol("health_sync_timeout");
  async function raceHealth<T>(label: string, p: Promise<T>): Promise<T | typeof healthSyncTimeoutSentinel> {
    const out = await Promise.race([
      p,
      new Promise<typeof healthSyncTimeoutSentinel>((resolve) => {
        setTimeout(() => resolve(healthSyncTimeoutSentinel), HEALTH_CALL_TIMEOUT_MS);
      }),
    ]);
    if (out === healthSyncTimeoutSentinel) {
      console.warn(`[health-sync] ${label} timed out (${HEALTH_CALL_TIMEOUT_MS}ms)`);
    }
    return out;
  }

  const handleSync = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    setErrorState(null);
    try {
      const raced = await raceHealth("syncHealthData", syncHealthData(userId));
      if (raced === healthSyncTimeoutSentinel) {
        setLastResult("Sync timed out");
        setErrorState({
          kind: "sync",
          message:
            "Health is taking too long to respond. Try again, or open iOS Settings → Privacy → Health → Suppr to confirm permissions.",
        });
        return;
      }
      const result = raced;
      const parts: string[] = [];
      if (result.stepsUpdated) parts.push("steps");
      if (result.weightUpdated) parts.push("weight");
      if (result.bodyFatUpdated) parts.push("body fat");
      if (result.activeEnergyUpdated) parts.push("active energy");
      if (result.workoutsUpdated) parts.push("workouts");
      if (result.basalBurnUpdated) parts.push("resting energy");

      // 2026-05-14 (premium-bar audit Group J #9): persist a per-category
      // last-sync timestamp for every flag that updated. Stamps the
      // moment the bridge returned, not the moment the sample was
      // generated upstream — close enough for "last pulled from
      // Health" copy and lets the row update without a second fetch.
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const nowIso = new Date().toISOString();
        const updates: Array<[HealthCategoryKey, string]> = [];
        if (result.stepsUpdated) updates.push(["steps", nowIso]);
        if (result.weightUpdated) updates.push(["weight", nowIso]);
        if (result.activeEnergyUpdated) updates.push(["active_energy", nowIso]);
        if (result.basalBurnUpdated) updates.push(["resting_energy", nowIso]);
        if (result.workoutsUpdated) updates.push(["workouts", nowIso]);
        await Promise.all(
          updates.map(([k, iso]) => AsyncStorage.setItem(LAST_SYNC_KEYS[k], iso)),
        );
        if (updates.length > 0) {
          setLastSyncTimes((prev) => {
            const next = { ...prev };
            for (const [k, iso] of updates) next[k] = iso;
            return next;
          });
        }
      } catch {
        /* timestamp persistence is best-effort */
      }

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
          setErrorState({
            kind: "sync",
            message:
              "Meal import from Apple Health failed. Most likely cause: Health permissions for dietary data weren't fully granted.",
          });
        }
      }

      setLastResult(bodyMsg.trim());
    } catch {
      setLastResult("Sync failed");
      setErrorState({
        kind: "sync",
        message:
          "Sync from Apple Health failed. Check that Suppr still has permission in iOS Settings.",
      });
    } finally {
      setSyncing(false);
    }
  }, [userId, importEnabled]);

  /**
   * F-57 follow-up — recovery affordance: deep-link to iOS Settings →
   * Privacy → Health → Suppr where the user can grant or re-grant
   * permissions. `app-settings:` opens Suppr's app-settings page;
   * Apple Health permissions are reached from there in two taps. We
   * deliberately don't try to open Health.app directly because there
   * is no public scheme for "Health permissions for app X" and the
   * generic `x-apple-health://` jumps to Health's home screen which
   * is even less helpful.
   */
  const handleOpenIOSSettings = useCallback(async () => {
    try {
      await Linking.openURL("app-settings:");
    } catch {
      try {
        await Linking.openSettings();
      } catch {
        Alert.alert(
          "Couldn't open Settings",
          "Open the Settings app, scroll to Suppr, then tap Health to manage permissions.",
        );
      }
    }
  }, []);

  const handleRetryAfterError = useCallback(() => {
    const kind = errorState?.kind;
    setErrorState(null);
    if (kind === "sync") {
      void handleSync();
    } else {
      void handleConnect();
    }
  }, [errorState?.kind, handleConnect, handleSync]);

  // 2026-05-13 (Grace TF feedback) — diagnostic write probe. Fires a
  // single `saveFood` call with a labelled 1 kcal sample via
  // `probeNutritionWrite` so the alert can surface the real bridge
  // error instead of guessing at permissions.
  const handleTestWrite = useCallback(() => {
    Alert.alert(
      "Send a test meal to Apple Health?",
      'This writes a labelled 1 kcal entry called "Suppr test write" to verify the connection. You can delete it from the Health app afterwards.',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send test",
          onPress: async () => {
            const result = await probeNutritionWrite();
            if (result.ok) {
              Alert.alert(
                "Test write succeeded ✓",
                "Open Apple Health → Browse → Nutrition → Dietary Energy. You should see a 1 kcal entry from Suppr. Real meals will write automatically as you log them.",
              );
            } else {
              Alert.alert("Test write blocked", result.reason);
            }
          },
        },
      ],
    );
  }, []);

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
    <ScrollView testID="screen-health-sync" style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Health Sync</Text>
        <View style={{ width: 32 }} />
      </View>

      <View
        testID="health-sync-apple-card"
        style={[styles.card, winMoment.flashStyle]}
      >
        <CardTitle styles={styles} icon="heart" text="Apple Health / Health Connect" />
        <Text style={styles.desc}>
          Automatically sync your steps, weight, and active energy from Apple Health (iOS) or Google Health Connect (Android). Steps and active energy appear on the Today tab for whichever day you select; water there is from quick-adds plus water logged on foods.
        </Text>

        {/* P1-21 (2026-04-25 design-system-enforcer + Carryover rule
            #2): swap Ionicons for lucide-react-native to match the
            Claude Design prototype's icon language used everywhere else
            in the product.
            2026-05-14 (premium-bar audit Group J #9): each row now
            shows a "Synced X min ago" subtitle so the user can see at
            a glance how fresh each category is. Pre-connect / pre-
            first-sync rows render "Never synced" — same visual slot
            so the layout doesn't jump after the first Sync Now. */}
        <View style={{ marginTop: Spacing.lg }}>
          <HealthCategoryRow
            icon={Footprints}
            label="Daily step count"
            lastSyncedAt={lastSyncTimes.steps}
            connected={connected}
            colors={colors}
            styles={styles}
          />
          <HealthCategoryRow
            icon={Scale}
            label="Weight measurements"
            lastSyncedAt={lastSyncTimes.weight}
            connected={connected}
            colors={colors}
            styles={styles}
          />
          <HealthCategoryRow
            icon={Flame}
            label="Active energy burned"
            lastSyncedAt={lastSyncTimes.active_energy}
            connected={connected}
            colors={colors}
            styles={styles}
          />
          <HealthCategoryRow
            icon={HeartPulse}
            label="Resting energy burned"
            lastSyncedAt={lastSyncTimes.resting_energy}
            connected={connected}
            colors={colors}
            styles={styles}
          />
          <HealthCategoryRow
            icon={Dumbbell}
            label="Workouts"
            lastSyncedAt={lastSyncTimes.workouts}
            connected={connected}
            colors={colors}
            styles={styles}
          />
        </View>
      </View>

      {/* Nutrition export card */}
      <View style={styles.card}>
        <CardTitle styles={styles} icon="nutrition" text="Nutrition Sync" />
        {/* 2026-05-13 (TF feedback `AOe4rm7514fI3dj_TliRdqk` —
            "internal language needs to be removed"): the prior copy
            leaked an audit-doc reference ("Audit/2026-04-30"), a
            competitor name ("matching MyFitnessPal / Cal AI"), and
            internal jargon ("Complete Day"). Rewritten in plain
            English for the user-facing surface. */}
        <Text style={styles.desc}>
          Share your Suppr meals to Apple Health so other apps can see them. Energy, protein, carbs, fat, and fibre are written each time you log a meal — AI-estimated rows are skipped until you confirm them.
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
            Your logged meals will be written to Apple Health for other apps to read. Each meal is written when you log it; re-logs of the same entry are de-duplicated.
          </Text>

          {/* 2026-05-13 (Grace TF feedback — "meals are not sharing
              to Health from Suppr, only from Health to Suppr"): the
              write path had no diagnostic. Root cause shipped the
              same day was a method-name mismatch — our code called
              `hk.saveFoodSample` but react-native-health exposes
              `hk.saveFood`, so every meal silently no-op'd. This
              "Send a test meal" button now writes a 1-kcal probe via
              `probeNutritionWrite`, which surfaces the real bridge
              error in the alert. */}
          {exportEnabled && available && connected ? (
            <Pressable
              onPress={handleTestWrite}
              accessibilityRole="button"
              accessibilityLabel="Send a test meal to Apple Health to verify writes work"
              testID="health-sync-test-write"
              style={({ pressed }) => ({
                marginTop: Spacing.sm,
                marginLeft: 28,
                alignSelf: "flex-start",
                paddingHorizontal: Spacing.md,
                paddingVertical: 8,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Accent.primary + "55",
                backgroundColor: Accent.primary + "10",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: Accent.primary }}>
                Send a test meal to Health →
              </Text>
            </Pressable>
          ) : null}
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

      {/* F-57 Build 41 — persistent error banner with recovery
          affordances. Renders only when a connect or sync attempt
          failed, replacing the previous one-line "Sync failed" text
          with a labelled banner + two buttons: "Try again" (re-runs
          the failed flow) and "Open iOS Settings" (deep-links to the
          Suppr → Privacy → Health permissions page). Pinned by
          apps/mobile/tests/unit/healthSyncErrorRecovery.test.tsx. */}
      {errorState && (
        <View
          testID="health-sync-error-banner"
          style={{
            marginHorizontal: Spacing.xl,
            marginBottom: Spacing.md,
            padding: Spacing.lg,
            backgroundColor: Accent.destructive + "12",
            borderColor: Accent.destructive + "40",
            borderWidth: 1,
            borderRadius: Radius.md,
            gap: Spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="alert-circle" size={18} color={Accent.destructive} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: Accent.destructive }}>
              {errorState.kind === "sync" ? "Sync didn't complete" : "Couldn't connect to Apple Health"}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
            {errorState.message}
          </Text>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: 4 }}>
            <Pressable
              testID="health-sync-error-retry"
              onPress={handleRetryAfterError}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: Radius.md,
                backgroundColor: Accent.primary,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                Try again
              </Text>
            </Pressable>
            <Pressable
              testID="health-sync-error-open-settings"
              onPress={handleOpenIOSSettings}
              accessibilityRole="button"
              accessibilityLabel="Open iOS Settings to manage Apple Health permissions"
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: Accent.primary,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: Accent.primary }}>
                Open iOS Settings
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 14, marginTop: 2 }}>
            In Settings: tap Privacy & Security → Health → Suppr → enable
            every category you want to share.
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

/**
 * 2026-05-14 (premium-bar audit Group J #9): per-category row with
 * label, last-sync subtitle, and connection check. Extracted so the
 * five rows render identically without 5x duplication of the same
 * layout JSX.
 */
function HealthCategoryRow({
  icon: Icon,
  label,
  lastSyncedAt,
  connected,
  colors,
  styles,
}: {
  icon: typeof Footprints;
  label: string;
  lastSyncedAt: string | null;
  connected: boolean;
  colors: ReturnType<typeof useThemeColors>;
  styles: any;
}) {
  return (
    <View style={styles.feature}>
      <Icon size={20} color={Accent.primary} strokeWidth={1.75} />
      <View style={{ flex: 1 }}>
        <Text style={styles.featureText}>{label}</Text>
        <Text
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            marginTop: 2,
            fontVariant: ["tabular-nums"],
          }}
        >
          {connected ? formatLastSync(lastSyncedAt) : "Connect to enable"}
        </Text>
      </View>
      <Ionicons
        name={connected ? "checkmark-circle" : "ellipse-outline"}
        size={20}
        color={connected ? Accent.success : colors.textTertiary}
      />
    </View>
  );
}