/**
 * Build-40 (2026-05-01) — onboarding terminal step. Re-introduces the
 * data-bridges into the linear flow as a single optional step.
 *
 * Three competitor-refugee personas (MFP, MacroFactor, Paprika) bounced
 * on day 1 because the customer-lens-shrunk flow ended at Reveal with
 * no path to bring their existing data with them. The four cards here
 * cover the bridges most users land at the door with:
 *
 *   1. Manual targets — paste-in 4-input form for users who already
 *      know their kcal / P / C / F (MFP / MacroFactor refugees).
 *      Persisted via `effectiveTargetsForPersist()` which OVERRIDES
 *      the BMR-computed targets when all four fields are set.
 *   2. Apple Health — wraps `requestHealthPermissions` →
 *      `syncHealthData(userId)`. On deny, opens iOS Settings via
 *      `Linking.openURL("app-settings:")`. iOS-only — Android falls
 *      through to a no-op (per project_ios_only_no_android.md).
 *   3. Notifications — gentle reminders on by default for retention.
 *      Lazy-import `expo-notifications` so Expo Go doesn't crash on
 *      mount.
 *   4. Recipe URL — preserves the legacy `import.tsx` Instagram-link
 *      parser as a card. Idle / parsing / done phases lifted from the
 *      legacy step (kept intact on disk) so the demo affordance stays
 *      familiar.
 *
 * Each card is independently skippable; the user can pick any one,
 * several, or none. A fifth "Maybe later" affordance lets them advance
 * the empty path without touching anything. `dataBridgeChosen` is the
 * audit signal capturing which path they took (or "skip"); the shell's
 * Build my plan CTA fires the canonical `onboarding_completed` event
 * with this value in the payload.
 *
 * Web mirror at `src/app/components/onboarding/steps/data-bridges.tsx`.
 * Web omits the Apple Health card (iOS-only) per
 * `project_ios_only_no_android.md` + the absence of HealthKit on web.
 */
import * as React from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Accent, MacroColors, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { requestHealthPermissions, syncHealthData } from "@/lib/healthSync";
import {
  markNotificationsPromptDismissed,
  registerExpoPushTokenForUser,
} from "@/lib/expoPushToken";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../../../src/lib/analytics/events";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";
import { MobileMfpCsvImportCard } from "../../imports/MfpCsvImportCard";

export function MobileDataBridgesStep() {
  const overline = useStepOverline();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Bring your data with you"
        subtitle="Skip any of these — or all of them. You can always set this up later in Settings."
      />

      <ManualTargetsCard />
      {Platform.OS === "ios" ? <AppleHealthCard userId={userId} /> : null}
      <NotificationsCard userId={userId} />
      <RecipeUrlCard />
      <MobileMfpCsvImportCard surface="onboarding" />

      {/*
        P1 (customer-lens 2026-05-11): the in-body "Maybe later" link
        was removed. It competed with the footer "Build my plan" CTA —
        two terminal actions on the same screen confused testers
        ("which one finishes setup?"). `canAdvance("data-bridges")`
        always returns true (see `src/lib/onboarding/state.ts:408`),
        so the footer "Build my plan" advances cleanly with zero cards
        touched. `dataBridgeChosen` stays null when nothing's picked,
        which the `onboarding_completed` event already reports as a
        first-class "skip" via its `data_bridge_chosen: null` value.
      */}
    </MobileStepBody>
  );
}

/* ---------------------------------------------------------------- */
/* Manual targets card (kcal / P / C / F)                           */
/* ---------------------------------------------------------------- */

function ManualTargetsCard() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  // Mirror state.* into local string buffers so the user can clear
  // a field mid-edit (numeric inputs don't tolerate empty-string
  // round-trips through Number).
  const [kcal, setKcal] = React.useState(
    state.manualTargetsKcal != null ? String(state.manualTargetsKcal) : "",
  );
  const [protein, setProtein] = React.useState(
    state.manualTargetsProteinG != null ? String(state.manualTargetsProteinG) : "",
  );
  const [carbs, setCarbs] = React.useState(
    state.manualTargetsCarbsG != null ? String(state.manualTargetsCarbsG) : "",
  );
  const [fat, setFat] = React.useState(
    state.manualTargetsFatG != null ? String(state.manualTargetsFatG) : "",
  );

  const commit = React.useCallback(() => {
    const k = Number(kcal);
    const p = Number(protein);
    const c = Number(carbs);
    const f = Number(fat);
    set({
      manualTargetsKcal: kcal && Number.isFinite(k) ? k : null,
      manualTargetsProteinG: protein && Number.isFinite(p) ? p : null,
      manualTargetsCarbsG: carbs && Number.isFinite(c) ? c : null,
      manualTargetsFatG: fat && Number.isFinite(f) ? f : null,
      dataBridgeChosen: "manual",
    });
    track(AnalyticsEvents.onboarding_data_bridge_chosen, { option: "manual" });
  }, [kcal, protein, carbs, fat, set]);

  return (
    <BridgeCard
      icon="calculator-outline"
      iconColor={Accent.primaryLight}
      title="I already know my targets"
      body="Paste them in — we'll use these instead of the BMR estimate. You can re-calibrate any time in Settings."
    >
      <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
        <TargetInput
          label="kcal"
          value={kcal}
          onChangeText={setKcal}
          onBlur={commit}
          color={Accent.primaryLight}
        />
        <TargetInput
          label="P g"
          value={protein}
          onChangeText={setProtein}
          onBlur={commit}
          color={MacroColors.protein}
        />
        <TargetInput
          label="C g"
          value={carbs}
          onChangeText={setCarbs}
          onBlur={commit}
          color={MacroColors.carbs}
        />
        <TargetInput
          label="F g"
          value={fat}
          onChangeText={setFat}
          onBlur={commit}
          color={MacroColors.fat}
        />
      </View>
      <Text
        style={{
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 8,
          fontStyle: "italic",
        }}
      >
        Set all four to override; partial values are ignored.
      </Text>
    </BridgeCard>
  );
}

function TargetInput({
  label,
  value,
  onChangeText,
  onBlur,
  color,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  onBlur: () => void;
  color: string;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.inputBg,
        borderRadius: Radius.sm,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType="numeric"
        accessibilityLabel={`Manual ${label} target`}
        style={{
          fontSize: 16,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
          color: colors.text,
          paddingVertical: 0,
          marginTop: 2,
        }}
      />
    </View>
  );
}

/* ---------------------------------------------------------------- */
/* Apple Health card — iOS only                                     */
/* ---------------------------------------------------------------- */

function AppleHealthCard({ userId }: { userId: string | null }) {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const granted = state.healthGranted === true;

  const onAllow = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await requestHealthPermissions();
      if (outcome.ok) {
        set({ healthGranted: true, dataBridgeChosen: "apple-health" });
        track(AnalyticsEvents.onboarding_data_bridge_chosen, { option: "apple-health" });
        // Best-effort first sync so the user sees their adaptive
        // TDEE running on real data on day 1.
        if (userId) {
          try {
            await syncHealthData(userId);
          } catch {
            /* sync errors are non-fatal — user can re-trigger from Settings */
          }
        }
      } else {
        set({ healthGranted: false });
        setError(outcome.userMessage);
      }
    } catch {
      set({ healthGranted: false });
      setError(
        "We couldn't show the Health permission sheet. You can connect later in Settings.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, set, userId]);

  const onOpenSettings = React.useCallback(() => {
    void Linking.openURL("app-settings:");
  }, []);

  return (
    <BridgeCard
      icon="heart-outline"
      iconColor={MacroColors.fat}
      title="Connect Apple Health"
      body="Read active energy + steps so your adaptive TDEE calibrates from day 1. Suppr never writes to Health."
      grantedBadge={granted ? "Connected" : null}
    >
      {error ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            backgroundColor: Accent.warning + "1A",
            borderRadius: Radius.sm,
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="alert-circle-outline" size={14} color={Accent.warning} />
          <Text style={{ flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            {error}
          </Text>
          <Pressable onPress={onOpenSettings}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: Accent.primaryLight }}>
              Open Settings
            </Text>
          </Pressable>
        </View>
      ) : null}
      {!granted ? (
        <Pressable
          onPress={() => void onAllow()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Connect Apple Health"
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => ({
            marginTop: 12,
            height: 40,
            borderRadius: 12,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color="#0a0a0f" size="small" />
          ) : (
            <Text style={{ color: "#0a0a0f", fontSize: 13, fontWeight: "700" }}>
              Allow Health access
            </Text>
          )}
        </Pressable>
      ) : null}
    </BridgeCard>
  );
}

/* ---------------------------------------------------------------- */
/* Notifications card                                                */
/* ---------------------------------------------------------------- */

function NotificationsCard({ userId }: { userId: string | null }) {
  const { state, set } = useOnboarding();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const granted = state.notifGranted === true;

  const onAllow = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
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
        set({ notifGranted: true, dataBridgeChosen: "notifications" });
        track(AnalyticsEvents.onboarding_data_bridge_chosen, { option: "notifications" });
        await registerExpoPushTokenForUser(userId);
        await markNotificationsPromptDismissed();
      } else {
        set({ notifGranted: false });
        setError("Notifications are off. You can enable them in Settings.");
        await markNotificationsPromptDismissed();
      }
    } catch {
      set({ notifGranted: false });
      setError(
        "System notifications need a full Suppr install (not Expo Go).",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, set, userId]);

  return (
    <BridgeCard
      icon="notifications-outline"
      iconColor={Accent.warning}
      title="Gentle reminders"
      body="Off-target evening nudge + a Sunday recap. Two notifications max per week."
      grantedBadge={granted ? "On" : null}
    >
      {error ? (
        <Text
          style={{ fontSize: 11, color: Accent.warning, marginTop: 8, lineHeight: 16 }}
        >
          {error}
        </Text>
      ) : null}
      {!granted ? (
        <Pressable
          onPress={() => void onAllow()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Turn on notifications"
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => ({
            marginTop: 12,
            height: 40,
            borderRadius: 12,
            backgroundColor: Accent.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color="#0a0a0f" size="small" />
          ) : (
            <Text style={{ color: "#0a0a0f", fontSize: 13, fontWeight: "700" }}>
              Turn on
            </Text>
          )}
        </Pressable>
      ) : null}
    </BridgeCard>
  );
}

/* ---------------------------------------------------------------- */
/* Recipe URL card — preserves legacy import demo                   */
/* ---------------------------------------------------------------- */

function RecipeUrlCard() {
  const colors = useThemeColors();
  return (
    <BridgeCard
      icon="link-outline"
      iconColor={Accent.successLight}
      title="Recipe import"
      body="Suppr parses Instagram, TikTok, blog, and YouTube links — ingredients matched against USDA / OFF."
      grantedBadge={null}
    >
      <Text
        style={{
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 10,
          lineHeight: 17,
        }}
      >
        Try it after setup — open the Library tab and tap the share icon to
        paste a link, or share any recipe to Suppr from inside Instagram /
        TikTok / Safari.
      </Text>
    </BridgeCard>
  );
}

/* ---------------------------------------------------------------- */
/* Shared bridge-card chrome                                        */
/* ---------------------------------------------------------------- */

function BridgeCard({
  icon,
  iconColor,
  title,
  body,
  grantedBadge,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  body: string;
  grantedBadge?: string | null;
  children?: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: grantedBadge ? Accent.success + "66" : colors.border,
      }}
    >
      <View
        style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconColor + "26",
          }}
        >
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: "700",
                color: colors.text,
                letterSpacing: -0.2,
              }}
            >
              {title}
            </Text>
            {grantedBadge ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: Accent.success + "26",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}
              >
                <Ionicons name="checkmark" size={10} color={Accent.successLight} />
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: Accent.successLight,
                  }}
                >
                  {grantedBadge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginTop: 4,
              lineHeight: 18,
            }}
          >
            {body}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}
