import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "@/hooks/use-safe-back";
import {
  AlertCircle,
  ChevronLeft,
  Download,
  Dumbbell,
  EyeOff,
  Flame,
  Footprints,
  Heart,
  HeartPulse,
  Scale,
  Share2,
  Trash2,
  Utensils,
} from "lucide-react-native";
import { Accent, Elevation, FontFamily, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useSettingsWinMoment } from "@/hooks/useSettingsWinMoment";
import {
  formatNutritionImportSummary,
  isExpoGoRuntime,
  isHealthSyncAvailable,
  probeHealthAccess,
  probeNutritionImport,
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

/**
 * Leading status-dot colour for a HealthCategoryRow.
 *   - "Connect to enable" (not connected) → muted `#ECEAE4`
 *   - Connected, never synced → amber `#C9892C`
 *   - Connected + synced → success green `#5E7C5A`
 *
 * settings.md §3.10: LEADING status dot (green=synced / amber=never synced /
 * muted=connect to enable), not a trailing circle.
 */
function statusDotColor(connected: boolean, lastSyncedAt: string | null): string {
  if (!connected) return "#ECEAE4";
  if (!lastSyncedAt) return Accent.warning; // amber — connected but never synced
  return Accent.success;                     // green — synced at least once
}

export default function HealthSyncScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)/settings");
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the source-toggle
  // switch tracks, settings-row glyphs, and connect/manage CTAs. Threaded into
  // the memoised StyleSheet via the dep array below. Disconnect actions keep
  // `Accent.destructive`; connected state keeps `Accent.success`.
  const accent = useAccent();
  // One-card-treatment soft elevation (docs/decisions/2026-06-09-one-card-treatment-
  // soft-elevation.md): the Apple Health card, the source-toggle card, and the
  // warning card all sit directly on the page ground, so they take the SOFT lift.
  // Routed through the elevation system (was a hand-rolled `Elevation.cardSoft` on
  // the wrapper + an always-on hairline): the hook gives the cardSoft penumbra
  // (light, no border) / tonal lift + hairline (dark), so the light double-edge is
  // gone and the treatment can't drift from the other surfaces.
  const cardElevation = useCardElevation({ variant: "soft" });
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
  /** Cooldown after Connect — avoid probeHealthAccess racing native settle (iOS 26+). */
  const connectFinishedAtRef = useRef(0);

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
  // → Sloe where the user can grant or re-grant permissions).
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
  // Sloe). Previously the flag was treated as authoritative for the
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
        // Avoid concurrent HealthKit reads during connect/sync — native bridge
        // crashes have been observed when probe + initHealthKit overlap (iOS 26+).
        if (connecting || syncing) return;
        if (Date.now() - connectFinishedAtRef.current < 6_000) return;
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
    }, [connecting, syncing]),
  );

  // If native never calls back, don't leave the Connect button spinning when leaving this screen.
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
        "Apple Health isn't available in Expo Go. Open this app from a development build (Xcode or `expo run:ios --device`).",
      );
      return;
    }
    if (!available) {
      Alert.alert(
        "Not available",
        __DEV__
          ? "The Health native module isn't in this build. From apps/mobile run `npx expo prebuild --platform ios`, then rebuild and install on your iPhone."
          : "Apple Health isn't available on this device.",
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
        let dietaryImportReady = outcome.dietaryImportReady;
        let dietaryMessage = outcome.userMessage;
        let dietaryDebug = outcome.debugDetail;
        try {
          const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
          await AsyncStorage.setItem(HEALTH_APPLE_CONNECTED_KEY, "true");
          // P1-15: auto-enable meal import on first connect — but request dietary
          // permissions in a separate native call (bulk init crashed on iOS 26+).
          const existing = await AsyncStorage.getItem("health_import_nutrition");
          if (existing == null) {
            const dietary = await requestDietaryHealthPermissions();
            dietaryImportReady = dietary.dietaryImportReady;
            dietaryMessage = dietary.userMessage;
            dietaryDebug = dietary.debugDetail;
            if (dietary.dietaryImportReady) {
              await AsyncStorage.setItem("health_import_nutrition", "true");
              setImportEnabled(true);
            }
          } else if (existing === "true") {
            // Re-request dietary reads — stage-1-only connect (or a prior crash) can leave
            // import ON in storage without EnergyConsumed read permission (HK returns []).
            setImportEnabled(true);
            const dietary = await requestDietaryHealthPermissions();
            dietaryImportReady = dietary.dietaryImportReady;
            dietaryMessage = dietary.userMessage;
            dietaryDebug = dietary.debugDetail;
          }
          const existingExport = await AsyncStorage.getItem("health_export_nutrition");
          if (existingExport == null) {
            await AsyncStorage.setItem("health_export_nutrition", "true");
            setExportEnabled(true);
          }
        } catch {
          /* ignore */
        }
        connectFinishedAtRef.current = Date.now();
        // ENG-824 — after native work completes (quiet success haptic).
        winMoment.celebrate();
        const body = dietaryImportReady
          ? dietaryMessage
          : `${dietaryMessage}${dietaryDebug ? `\n\nTechnical detail:\n${dietaryDebug}` : ""}`;
        setLastResult(
          dietaryImportReady
            ? "Health connected. Use Sync Now to pull your latest data."
            : "Health connected for activity. Meal import may need another permission — see the alert.",
        );
        Alert.alert(dietaryImportReady ? "Connected" : "Connected (limited)", body, [
          { text: "OK" },
          ...(!dietaryImportReady
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
            "Health is taking too long to respond. Try again, or open iOS Settings → Privacy → Health → Sloe to confirm permissions.",
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
        const dietary = await requestDietaryHealthPermissions();
        if (!dietary.dietaryImportReady) {
          bodyMsg = `${bodyMsg} Meal import needs Dietary Energy read access — toggle Import meals off and on, or open Settings → Health → Sloe and enable Dietary Energy.`;
        }
        try {
          const n = dietary.dietaryImportReady
            ? await syncNutritionFromHealth(userId, 120)
            : { imported: [], skippedOwn: 0, skippedNoName: 0, externalEnergyCount: 0, skippedDedup: 0, skippedNonPositive: 0, insertAttempted: 0, insertFailed: 0, healthKitUnavailable: false };
          bodyMsg = `${bodyMsg} ${formatNutritionImportSummary(n)}`;
          if (n.insertFailed > 0) {
            setErrorState({
              kind: "sync",
              message:
                "Some meals from Apple Health could not be saved. Check your connection and try Sync Now again.",
            });
          }
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
          "Sync from Apple Health failed. Check that Sloe still has permission in iOS Settings.",
      });
    } finally {
      setSyncing(false);
    }
  }, [userId, importEnabled]);

  /**
   * F-57 follow-up — recovery affordance: deep-link to iOS Settings →
   * Privacy → Health → Sloe where the user can grant or re-grant
   * permissions. `app-settings:` opens Sloe's app-settings page;
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
          "Open the Settings app, scroll to Sloe, then tap Health to manage permissions.",
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
  const handleTestImport = useCallback(() => {
    Alert.alert(
      "Check meal import from Health?",
      "This reads dietary energy samples from other apps (e.g. MyFitnessPal) in the last 7 days. Nothing is written to your journal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Check",
          onPress: async () => {
            const dietary = await requestDietaryHealthPermissions();
            if (!dietary.dietaryImportReady) {
              Alert.alert(
                "Meal read permission needed",
                `${dietary.userMessage}${dietary.debugDetail ? `\n\nTechnical detail:\n${dietary.debugDetail}` : ""}\n\nWithout Dietary Energy read access, Apple Health looks empty to Sloe even when MyFitnessPal data is visible in the Health app.`,
                [
                  { text: "OK", style: "default" },
                  { text: "Open Settings", onPress: () => void Linking.openSettings() },
                ],
              );
              return;
            }
            const result = await probeNutritionImport(7);
            if (!result.ok) {
              Alert.alert("Import check failed", result.reason);
              return;
            }
            const sources =
              result.sourceApps.length > 0
                ? result.sourceApps.join(", ")
                : "none detected";
            const permissionHint =
              result.totalEnergyCount === 0
                ? "\n\nHealth returned zero dietary-energy samples — Sloe may not have read permission yet. Open Settings → Health → Sloe and enable Dietary Energy (and other meal types if listed)."
                : result.ownSamplesSkipped > 0 && result.externalEnergyCount === 0
                  ? `\n\nHealth has ${result.totalEnergyCount} sample${result.totalEnergyCount === 1 ? "" : "s"}, but all are from Sloe (nothing from MFP/other apps yet).`
                  : "";
            Alert.alert(
              result.externalEnergyCount > 0 ? "Meals found in Health ✓" : "No meals found in Health",
              result.externalEnergyCount > 0
                ? `Found ${result.externalEnergyCount} dietary energy sample${result.externalEnergyCount === 1 ? "" : "s"} from other apps in the last 7 days (sources: ${sources}). Tap Sync Now to import new items into Sloe.`
                : `No dietary energy from other apps in the last 7 days. Log food in MyFitnessPal with Health sharing on, then open Health → Browse → Nutrition → Dietary Energy — you should see individual foods with times, not only one daily total.${permissionHint}`,
            );
          },
        },
      ],
    );
  }, []);

  const handleTestWrite = useCallback(() => {
    Alert.alert(
      "Send a test meal to Apple Health?",
      'This writes a labelled 1 kcal entry called "Sloe test write" to verify the connection. You can delete it from the Health app afterwards.',
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send test",
          onPress: async () => {
            const result = await probeNutritionWrite();
            if (result.ok) {
              Alert.alert(
                "Test write succeeded ✓",
                "Open Apple Health → Browse → Nutrition → Dietary Energy. You should see a 1 kcal entry from Sloe. Real meals will write automatically as you log them.",
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

  // Icon width (20pt) + row gap (Spacing.sm = 8pt) — expressed as a derived
  // constant so helper-text indent doesn't rely on a magic literal 28.
  const ICON_INDENT = 20 + Spacing.sm; // = 28pt, derived not magic

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        // Left-aligned stacked header: back chevron + title on the same row,
        // title left-aligned per settings.md §4 (Fraunces/Newsreader 28sp bold).
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
        },
        title: {
          fontFamily: FontFamily.serifRegular,
          fontSize: 28,
          lineHeight: 34,
          fontWeight: "700" as const,
          color: colors.text,
          // Left-aligned — no textAlign: "center", no flex:1 centering trick
        },
        // Section eyebrow: ALL-CAPS, Inter 11sp, +0.08em tracking, sage colour.
        // settings.md §4: 24pt above / 8pt below each eyebrow.
        eyebrow: {
          ...Type.label,
          color: colors.textSecondary,
          marginHorizontal: Spacing.xl,
          marginTop: Spacing.xl,    // 24pt above
          marginBottom: Spacing.sm, // 8pt below
        },
        // Standard settings card — 16pt padding (settings.md §4 "16px all sides"),
        // Radius.xl (12pt) — closest on-scale token to spec's 16pt ideal.
        // Elevation.cardSoft on an OUTER wrapper for iOS shadow (overflow:hidden
        // clips shadows so the shadow must live outside the border-clipped card).
        cardShadowWrapper: {
          marginHorizontal: Spacing.xl,
          marginBottom: Spacing.md,
          borderRadius: Radius.xl,
          // Soft lift via the elevation system (light → cardSoft shadow; dark →
          // no shadow, the inner card carries the tonal lift + hairline instead).
          ...(cardElevation.shadowStyle ?? {}),
        },
        card: {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: Radius.xl,
          // Light soft-lift drops the hairline (the shadow is the separation);
          // dark soft-lift keeps it (no shadow there). Driven by `useBorder`.
          borderWidth: cardElevation.useBorder ? 1 : 0,
          borderColor: colors.cardBorder ?? colors.border,
          padding: Spacing.md,       // 16pt — standard settings card
          overflow: "hidden" as const,
        },
        // Card title — Fraunces ~18sp/600 (display-section editorial register).
        // settings.md §3 treats sub-screen card headers as Fraunces display-section.
        cardTitle: {
          fontFamily: FontFamily.serifSemibold,
          fontSize: 18,
          lineHeight: 22,
          fontWeight: "600" as const,
          color: colors.text,
          marginBottom: Spacing.xs,
        },
        desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
        // Aubergine OUTLINE primary CTA (Sloe treatment #1, 2026-06-08) —
        // transparent fill, 1.5px border in `accent.primarySolid`, label in
        // the same. The everyday primary action reads as an accent line.
        btnOutline: {
          marginHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          borderColor: accent.primarySolid,
          backgroundColor: "transparent",
          alignItems: "center" as const,
          marginBottom: Spacing.md,
        },
        btnOutlineText: { fontSize: 16, fontWeight: "700" as const, color: accent.primarySolid },
        // Category row — 44pt minimum height (design-system §3.3 + settings.md §2).
        // paddingVertical: 12pt gives ~44pt with 20pt icon + label.
        feature: {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: Spacing.sm,
          paddingVertical: 12,
          minHeight: 44,
        },
        // Hairline separator between category rows (#ECEAE4).
        rowSeparator: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: ICON_INDENT, // inset from status-dot column
        },
        featureText: { fontSize: 14, color: colors.text, flex: 1 },
        // Helper/rationale text under toggles — on-scale type (Type.caption = 11sp
        // Inter Medium). Indent = icon width (20) + gap (Spacing.sm = 8) = 28pt,
        // expressed via ICON_INDENT constant. No negative marginTop hack.
        helperText: {
          ...Type.caption,
          color: colors.textTertiary,
          marginLeft: ICON_INDENT,
          marginBottom: Spacing.sm,
        },
      }),
    [colors, cardElevation, ICON_INDENT],
  );

  return (
    <ScrollView
      testID="screen-health-sync"
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Left-aligned stacked header: back chevron + serif title (settings.md §4) */}
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ChevronLeft size={24} color={colors.text} strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.title}>Health Sync</Text>
      </View>

      {/* CONNECT eyebrow — settings.md §3.10 */}
      <Text style={styles.eyebrow}>CONNECT</Text>

      {/* Apple Health card — shadow on outer wrapper so iOS doesn't clip it */}
      <View style={[styles.cardShadowWrapper, winMoment.flashStyle]} testID="health-sync-apple-card">
        <View style={styles.card}>
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
              so the layout doesn't jump after the first Sync Now.
              2026-06-09 (premium-bar audit gap 3): leading status dot
              replaces the trailing false-affordance ellipse/checkmark. */}
          <View style={{ marginTop: Spacing.md }}>
            <HealthCategoryRow
              icon={Footprints}
              label="Daily step count"
              lastSyncedAt={lastSyncTimes.steps}
              connected={connected}
              colors={colors}
              styles={styles}
            />
            <View style={styles.rowSeparator} />
            <HealthCategoryRow
              icon={Scale}
              label="Weight measurements"
              lastSyncedAt={lastSyncTimes.weight}
              connected={connected}
              colors={colors}
              styles={styles}
            />
            <View style={styles.rowSeparator} />
            <HealthCategoryRow
              icon={Flame}
              label="Active energy burned"
              lastSyncedAt={lastSyncTimes.active_energy}
              connected={connected}
              colors={colors}
              styles={styles}
            />
            <View style={styles.rowSeparator} />
            <HealthCategoryRow
              icon={HeartPulse}
              label="Resting energy burned"
              lastSyncedAt={lastSyncTimes.resting_energy}
              connected={connected}
              colors={colors}
              styles={styles}
            />
            <View style={styles.rowSeparator} />
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
      </View>

      {/* NUTRITION eyebrow — settings.md §3.10 */}
      <Text style={styles.eyebrow}>NUTRITION</Text>

      {/* Nutrition Sync card */}
      <View style={styles.cardShadowWrapper}>
        <View style={styles.card}>
          <CardTitle styles={styles} icon="utensils" text="Nutrition Sync" />
          {/* 2026-05-13 (TF feedback `AOe4rm7514fI3dj_TliRdqk` —
              "internal language needs to be removed"): the prior copy
              leaked an audit-doc reference ("Audit/2026-04-30"), a
              competitor name ("matching MyFitnessPal / Cal AI"), and
              internal jargon ("Complete Day"). Rewritten in plain
              English for the user-facing surface. */}
          <Text style={styles.desc}>
            Share your Sloe meals to Apple Health so other apps can see them. Energy, protein, carbs, fat, and fibre are written each time you log a meal — AI-estimated rows are skipped until you confirm them.
          </Text>

          <View style={{ marginTop: Spacing.md, gap: Spacing.xs }}>
            {/* Import meals toggle row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
                <Download size={20} color={accent.primary} strokeWidth={1.75} />
                <Text style={styles.featureText}>Import meals from Health</Text>
              </View>
              <Switch
                value={importEnabled}
                onValueChange={toggleImport}
                disabled={!available || !connected}
                trackColor={{ true: accent.primary }}
                accessibilityLabel={`Import meals from Health, currently ${importEnabled ? "on" : "off"}`}
              />
            </View>
            <Text style={styles.helperText}>
              Pull dietary energy (and matched macros when available) from other apps into your Today journal. Tap Sync Now after enabling.
            </Text>

            {importEnabled && available && connected ? (
              <Pressable
                onPress={handleTestImport}
                accessibilityRole="button"
                accessibilityLabel="Check whether Apple Health has meals from other apps to import"
                testID="health-sync-test-import"
                style={({ pressed }) => ({
                  flexDirection: "row" as const,
                  alignItems: "center" as const,
                  gap: Spacing.sm,
                  minHeight: 44,
                  paddingVertical: 12,
                  marginLeft: ICON_INDENT,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Utensils size={16} color={accent.primarySolid} strokeWidth={1.75} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600" as const, color: accent.primarySolid }}>
                    Test: check meal import
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                    Verifies Health has meals from other apps to import
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {/* Simple labels toggle row */}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: ICON_INDENT }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, opacity: importEnabled ? 1 : 0.45 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
                <EyeOff size={20} color={accent.primary} strokeWidth={1.75} />
                <Text style={styles.featureText}>Simple labels only (no food names)</Text>
              </View>
              <Switch
                value={genericImportLabels}
                onValueChange={toggleGenericImportLabels}
                disabled={!available || !connected || !importEnabled}
                trackColor={{ true: accent.primary }}
                accessibilityLabel={`Simple labels only, currently ${genericImportLabels ? "on" : "off"}`}
              />
            </View>
            <Text style={styles.helperText}>
              Calories, meal time bucket, and macros still come from Health; titles show as Imported food (N kcal) without brand or item names. Clear imported data once if you already synced detailed names.
            </Text>

            {/* Share meals toggle row */}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: ICON_INDENT }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flex: 1 }}>
                <Share2 size={20} color={accent.primary} strokeWidth={1.75} />
                <Text style={styles.featureText}>Share meals to Health</Text>
              </View>
              <Switch
                value={exportEnabled}
                onValueChange={toggleExport}
                disabled={!available || !connected}
                trackColor={{ true: accent.primary }}
                accessibilityLabel={`Share meals to Health, currently ${exportEnabled ? "on" : "off"}`}
              />
            </View>
            <Text style={styles.helperText}>
              Your logged meals will be written to Apple Health for other apps to read. Each meal is written when you log it; re-logs of the same entry are de-duplicated.
            </Text>

            {/* 2026-05-13 (Grace TF feedback — "meals are not sharing
                to Health from Sloe, only from Health to Sloe"): the
                write path had no diagnostic. Root cause shipped the
                same day was a method-name mismatch — our code called
                `hk.saveFoodSample` but react-native-health exposes
                `hk.saveFood`, so every meal silently no-op'd. This
                "Send a test meal" row now writes a 1-kcal probe via
                `probeNutritionWrite`, which surfaces the real bridge
                error in the alert. */}
            {exportEnabled && available && connected ? (
              <Pressable
                onPress={handleTestWrite}
                accessibilityRole="button"
                accessibilityLabel="Send a test meal to Apple Health to verify writes work"
                testID="health-sync-test-write"
                style={({ pressed }) => ({
                  flexDirection: "row" as const,
                  alignItems: "center" as const,
                  gap: Spacing.sm,
                  minHeight: 44,
                  paddingVertical: 12,
                  marginLeft: ICON_INDENT,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Share2 size={16} color={accent.primarySolid} strokeWidth={1.75} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600" as const, color: accent.primarySolid }}>
                    Test: write a meal to Health
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                    Verifies your Health write permission
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {/* Clear imported data — lucide Trash2 row, destructive styling.
                Consistent grammar with the test rows above (icon + label + subtitle).
                Replaces the previous floating centered text link. */}
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: ICON_INDENT }} />
            <Pressable
              onPress={handleClearImported}
              accessibilityRole="button"
              accessibilityLabel="Clear all imported data from Apple Health"
              style={({ pressed }) => ({
                flexDirection: "row" as const,
                alignItems: "center" as const,
                gap: Spacing.sm,
                minHeight: 44,
                paddingVertical: 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Trash2 size={20} color={Accent.destructive} strokeWidth={1.75} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600" as const, color: Accent.destructive }}>
                  Clear all imported data
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
                  Removes meals imported from Apple Health. Your manually logged meals are unaffected.
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Unavailable state — dev instruction gated behind __DEV__ so users
          only see a plain-English message (gap 11). "Suppr.xcworkspace" reference
          removed from user-facing copy. */}
      {!available && (
        <View style={[styles.cardShadowWrapper, { marginTop: Spacing.xs }]}>
          <View style={[styles.card, { borderColor: Accent.warning + "40", gap: Spacing.sm }]}>
            <Text style={{ fontSize: 14, color: Accent.warning, fontWeight: "600" as const }}>
              {isExpoGoRuntime()
                ? "Apple Health isn't available in Expo Go."
                : "Apple Health isn't available on this device."}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
              {isExpoGoRuntime()
                ? "Install the Sloe development build (not the Expo Go app), then return here."
                : __DEV__
                  ? "Rebuild with native modules: from apps/mobile run `npx expo prebuild --platform ios`, open the Xcode workspace, build to your iPhone, and start Metro (`npx expo start` or `npm run ios:device:tunnel`)."
                  : "Apple Health requires a device with Health support. If you're seeing this unexpectedly, try reinstalling the app."}
            </Text>
          </View>
        </View>
      )}

      {/* F-57 Build 41 — persistent error banner with recovery
          affordances. Renders only when a connect or sync attempt
          failed, replacing the previous one-line "Sync failed" text
          with a labelled banner + two buttons: "Try again" (re-runs
          the failed flow) and "Open iOS Settings" (deep-links to the
          Sloe → Privacy → Health permissions page). Pinned by
          apps/mobile/tests/unit/healthSyncErrorRecovery.test.tsx. */}
      {errorState && (
        <View
          testID="health-sync-error-banner"
          style={{
            marginHorizontal: Spacing.xl,
            marginBottom: Spacing.md,
            padding: Spacing.md,
            backgroundColor: Accent.destructive + "12",
            borderColor: Accent.destructive + "40",
            borderWidth: 1,
            borderRadius: Radius.xl,
            gap: Spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <AlertCircle size={18} color={Accent.destructive} strokeWidth={1.75} />
            <Text style={{ fontSize: 14, fontWeight: "700" as const, color: Accent.destructive }}>
              {errorState.kind === "sync" ? "Sync didn't complete" : "Couldn't connect to Apple Health"}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
            {errorState.message}
          </Text>
          {/* Recovery actions — both aubergine OUTLINE (Sloe treatment #1,
              2026-06-08). "Try again" is the primary recovery and "Open iOS
              Settings" the secondary; both read as accent lines (the prior
              filled "Try again" is now an outline to match the calm
              everyday-primary grammar). */}
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.xs }}>
            <Pressable
              testID="health-sync-error-retry"
              onPress={handleRetryAfterError}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 12,
                borderRadius: Radius.md,
                borderWidth: 1.5,
                borderColor: accent.primarySolid,
                backgroundColor: pressed ? accent.primarySoft : "transparent",
                alignItems: "center" as const,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: "700" as const, color: accent.primarySolid }}>
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
                borderWidth: 1.5,
                borderColor: accent.primarySolid,
                alignItems: "center" as const,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: "700" as const, color: accent.primarySolid }}>
                Open iOS Settings
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 14, marginTop: 2 }}>
            In Settings: tap Privacy & Security → Health → Sloe → enable
            every category you want to share.
          </Text>
        </View>
      )}

      {/* Connect / Sync — aubergine OUTLINE (Sloe treatment #1, 2026-06-08).
          The everyday primary CTA is an accent line, not a filled slab:
          transparent fill, 1.5px border + `accent.primarySolid` label. The
          unavailable Connect state stays a muted grey outline so the disabled
          affordance still reads as a button. (The ink Apple Sign-In button on
          auth screens is unaffected — this is the Health connect CTA.) */}
      {!connected ? (
        <Pressable
          style={[
            styles.btnOutline,
            {
              borderColor: available && !connecting ? accent.primarySolid : colors.textTertiary,
            },
          ]}
          onPress={handleConnect}
          disabled={!available || connecting}
        >
          {connecting ? (
            <ActivityIndicator color={accent.primarySolid} />
          ) : (
            <Text
              style={[
                styles.btnOutlineText,
                { color: available ? accent.primarySolid : colors.textTertiary },
              ]}
            >
              Connect Health Data
            </Text>
          )}
        </Pressable>
      ) : (
        <Pressable style={styles.btnOutline} onPress={handleSync} disabled={syncing}>
          {syncing ? (
            <ActivityIndicator color={accent.primarySolid} />
          ) : (
            <Text style={styles.btnOutlineText}>Sync Now</Text>
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

function CardTitle({ styles, icon, text }: { styles: any; icon: "heart" | "utensils"; text: string }) {
  // Secondary accent (Frost flag → damson, else clay) for the card-title glyph.
  // settings.md §3.10: lucide Heart (sage) for Apple Health card.
  // Design-system §0.1(b): no Ionicons for abstract controls — lucide only.
  const accent = useAccent();
  const IconComponent = icon === "heart" ? Heart : Utensils;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}>
      <IconComponent size={20} color={accent.primary} strokeWidth={1.75} />
      <Text style={styles.cardTitle}>{text}</Text>
    </View>
  );
}

/**
 * 2026-05-14 (premium-bar audit Group J #9): per-category row with
 * label, last-sync subtitle, and connection check. Extracted so the
 * five rows render identically without 5x duplication of the same
 * layout JSX.
 *
 * 2026-06-09 (premium-bar audit gap 3): leading 8pt status dot replaces
 * the trailing false-affordance ellipse/checkmark:
 *   - muted (#ECEAE4) when "Connect to enable" (not connected)
 *   - amber (#C9892C) when connected but never synced
 *   - success green (#5E7C5A) when "Synced X ago"
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
  // Secondary accent (Frost flag → damson, else clay) for the category glyph.
  const accent = useAccent();
  const dotColor = statusDotColor(connected, lastSyncedAt);
  const subtitleText = connected ? formatLastSync(lastSyncedAt) : "Connect to enable";

  return (
    <View style={[styles.feature, { gap: Spacing.sm }]}>
      {/* Leading 8pt status dot — state-scannable at a glance (settings.md §3.10) */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: dotColor,
          flexShrink: 0,
        }}
      />
      <Icon size={20} color={accent.primary} strokeWidth={1.75} />
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
          {subtitleText}
        </Text>
      </View>
    </View>
  );
}
