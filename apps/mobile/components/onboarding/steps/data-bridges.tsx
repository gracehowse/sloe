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
 *   4. Recipe import + MFP CSV — real `POST /api/recipe-import` call via
 *      `MobileOnboardingRecipeImportCard` (ENG-1304, 2026-07-03), replacing
 *      the earlier "try after setup" stub (the legacy `import.tsx` demo
 *      step is now dormant/unreachable, see its own file header). Order
 *      between the recipe-import and CSV cards is gated by
 *      `appChoiceDisplayName()`: CSV leads when app-choice named an
 *      importable app (self-identified refugee — CSV is their most
 *      relevant next step); recipe import leads otherwise (the
 *      default/majority path, and the product's acquisition-wedge growth
 *      bet).
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
  View,
} from "react-native";
import {
  Bell,
  Calculator,
  Check,
  CircleAlert,
  Heart,
  type LucideIcon,
} from "lucide-react-native";
import { Accent, MacroColors, MacroColorsDark, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { requestHealthPermissions, syncHealthData } from "@/lib/healthSync";
import {
  markNotificationsPromptDismissed,
  registerExpoPushTokenForUser,
} from "@/lib/expoPushToken";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";
import { MobileMfpCsvImportCard } from "../../imports/MfpCsvImportCard";
import { MobileOnboardingRecipeImportCard } from "../OnboardingRecipeImportCard";
import { appChoiceDisplayName } from "@suppr/shared/onboarding/appChoiceOptions";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { TargetInput } from "./TargetInput";

export function MobileDataBridgesStep() {
  const overline = useStepOverline();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { state } = useOnboarding();
  // ENG-990 — lead the importer card with the app the user told us they
  // were switching from (app-choice step), when it's one we can import.
  // `null` for "other" / "none" / no choice keeps the generic copy.
  const highlightApp = appChoiceDisplayName(state.appChoice);
  const csvCard = (
    <MobileMfpCsvImportCard surface="onboarding" highlightApp={highlightApp} />
  );
  const recipeCard = <MobileOnboardingRecipeImportCard />;

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Bring your data with you"
        subtitle="Skip any of these — or all of them. You can always set this up later in Settings."
      />

      {highlightApp ? (
        <>
          {csvCard}
          {recipeCard}
        </>
      ) : (
        recipeCard
      )}
      <ManualTargetsCard />
      {Platform.OS === "ios" ? <AppleHealthCard userId={userId} /> : null}
      <NotificationsCard userId={userId} />
      {highlightApp ? null : csvCard}

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
  // Secondary accent (Frost flag → damson, else clay) for the card's leading
  // glyph. The kcal field label stays clay deliberately (calories identity —
  // calories→plum reconciliation is a separate follow-up per the ship plan's
  // open Q1); the P/C/F field labels keep their `MacroColors`.
  const accent = useAccent(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
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
      icon={Calculator}
      iconColor={accent.primaryLight}
      title="I already know my targets"
      body="Paste them in — we'll use these instead of the BMR estimate. You can re-calibrate any time in Settings."
    >
      <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.dense }}>
        {/* kcal label held clay (calories identity, not the secondary accent) —
            calories→plum reconciliation is a separate follow-up (ship plan Q1). */}
        <TargetInput
          label="kcal"
          value={kcal}
          onChangeText={setKcal}
          onBlur={commit}
          color={accent.primaryLight}
        />
        <TargetInput
          label="P g"
          value={protein}
          onChangeText={setProtein}
          onBlur={commit}
          color={mc.protein}
        />
        <TargetInput
          label="C g"
          value={carbs}
          onChangeText={setCarbs}
          onBlur={commit}
          color={mc.carbs}
        />
        <TargetInput
          label="F g"
          value={fat}
          onChangeText={setFat}
          onBlur={commit}
          color={mc.fat}
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

/* ---------------------------------------------------------------- */
/* Apple Health card — iOS only                                     */
/* ---------------------------------------------------------------- */

function AppleHealthCard({ userId }: { userId: string | null }) {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the "Open Settings"
  // link and the "Allow Health access" CTA. The card's heart glyph keeps
  // `MacroColors.fat`, and the permission-error box keeps `Accent.warning`.
  const accent = useAccent(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
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
        // Best-effort first sync — adaptive TDEE on real data day 1.
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
      icon={Heart}
      iconColor={mc.fat}
      title="Connect Apple Health"
      body="Read active energy + steps so your adaptive TDEE calibrates from day 1. If you opt in later, logged meals can also sync back to Health."
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
            paddingHorizontal: Spacing.dense,
            paddingVertical: 8,
          }}
        >
          <CircleAlert size={14} color={Accent.warningSolid} />
          <Text style={{ flex: 1, fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
            {error}
          </Text>
          <Pressable onPress={onOpenSettings}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: accent.primaryLight }}>
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
            marginTop: Spacing.dense,
            height: 40,
            borderRadius: 12,
            backgroundColor: accent.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={accent.primaryForeground} size="small" />
          ) : (
            <Text style={{ color: accent.primaryForeground, fontSize: 13, fontWeight: "700" }}>
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
  // Secondary accent (Frost flag → damson, else clay) for the "Turn on" CTA.
  // The card's bell glyph + the permission-error text keep `Accent.warning`.
  const accent = useAccent();
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
        "System notifications need a full Sloe install (not Expo Go).",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, set, userId]);

  return (
    <BridgeCard
      icon={Bell}
      iconColor={Accent.warning}
      title="Gentle reminders"
      body="Off-target evening nudge + a Sunday recap. Two notifications max per week."
      grantedBadge={granted ? "On" : null}
    >
      {error ? (
        <Text
          style={{ fontSize: 11, color: Accent.warningSolid, marginTop: 8, lineHeight: 16 }}
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
            marginTop: Spacing.dense,
            height: 40,
            borderRadius: 12,
            backgroundColor: accent.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={accent.primaryForeground} size="small" />
          ) : (
            <Text style={{ color: accent.primaryForeground, fontSize: 13, fontWeight: "700" }}>
              Turn on
            </Text>
          )}
        </Pressable>
      ) : null}
    </BridgeCard>
  );
}

/* ---------------------------------------------------------------- */
/* Shared bridge-card chrome                                        */
/* ---------------------------------------------------------------- */

function BridgeCard({
  icon: Icon,
  iconColor,
  title,
  body,
  grantedBadge,
  children,
}: {
  icon: LucideIcon;
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
        borderRadius: CARD_RADIUS,
        padding: 16,
        marginBottom: 20, // Spacing.lg — breathable inter-card gap (was off-scale 12 = too tight, per Grace)
        borderWidth: 1,
        borderColor: grantedBadge ? Accent.success + "66" : colors.border,
      }}
    >
      <View
        style={{ flexDirection: "row", gap: Spacing.dense, alignItems: "flex-start" }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconColor + "26",
          }}
        >
          <Icon size={18} color={iconColor} />
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
                  paddingVertical: Spacing.xs,
                  borderRadius: Radius.full,
                }}
              >
                <Check size={10} strokeWidth={2.5} color={Accent.successLight} />
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
              ...Type.captionSmall,
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
