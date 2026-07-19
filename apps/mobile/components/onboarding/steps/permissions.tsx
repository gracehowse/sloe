import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Bell, Check, Heart, type LucideIcon } from "lucide-react-native";
import { Accent, MacroColorsSoft, MacroColorsSoftDark, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { useMacroColors } from "@/lib/macroColors";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAuth } from "@/context/auth";
import { requestHealthPermissions } from "@/lib/healthSync";
import {
  markNotificationsPromptDismissed,
  registerExpoPushTokenForUser,
} from "@/lib/expoPushToken";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

export function MobilePermissionsStep() {
  const { state, set } = useOnboarding();
  const overline = useStepOverline();
  const { colors: macro } = useMacroColors();
  // ENG-1521 — glyph-disc tints at the sanctioned Soft step, scheme-resolved
  // the same way `useMacroColors` resolves the base hues.
  const isDark = useResolvedScheme() === "dark";
  const macroSoft = isDark ? MacroColorsSoftDark : MacroColorsSoft;
  const warningSoft = isDark ? Accent.warningSoftDark : Accent.warningSoft;
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [healthBusy, setHealthBusy] = React.useState(false);
  const [healthError, setHealthError] = React.useState<string | null>(null);
  const [notifBusy, setNotifBusy] = React.useState(false);
  const [notifError, setNotifError] = React.useState<string | null>(null);

  // Real Apple Health prompt — wraps `requestHealthPermissions` so the
  // user actually sees the iOS HealthKit sheet. We treat any non-OK
  // outcome as "denied / unavailable" (e.g. Expo Go, simulator without
  // a dev build, restricted device); the user can still continue.
  const onAllowHealth = React.useCallback(async () => {
    if (healthBusy) return;
    setHealthBusy(true);
    setHealthError(null);
    try {
      // Health is iOS-only; on Android there is nothing to grant.
      if (Platform.OS !== "ios") {
        set({ healthGranted: false });
        setHealthError("Apple Health is only available on iOS.");
        return;
      }
      const outcome = await requestHealthPermissions();
      if (outcome.ok) {
        set({ healthGranted: true });
      } else {
        set({ healthGranted: false });
        setHealthError(outcome.userMessage);
      }
    } catch (e) {
      set({ healthGranted: false });
      setHealthError(
        "We couldn't show the Health permission sheet. You can connect later in Settings.",
      );
    } finally {
      setHealthBusy(false);
    }
  }, [healthBusy, set]);

  // Real iOS/Android notifications prompt via expo-notifications.
  // Lazy-import keeps Expo Go (no native module) from crashing on mount.
  const onAllowNotifications = React.useCallback(async () => {
    if (notifBusy) return;
    setNotifBusy(true);
    setNotifError(null);
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
        set({ notifGranted: true });
        // Register the Expo push token now that we have permission, so the
        // server has an address to push to. Also mark the standalone
        // /notifications-prompt screen as dismissed so the post-paywall
        // routing falls straight through to /(tabs) instead of re-asking.
        await registerExpoPushTokenForUser(userId);
        await markNotificationsPromptDismissed();
      } else {
        set({ notifGranted: false });
        setNotifError(
          "Notifications are off. You can enable them later in Settings → Sloe → Notifications.",
        );
        // The user has answered the OS prompt — even with "Don't Allow"
        // we should not re-ask via /notifications-prompt; honour their
        // choice. They can re-enable from Settings.
        await markNotificationsPromptDismissed();
      }
    } catch {
      set({ notifGranted: false });
      setNotifError(
        "System notifications need a full Sloe install (not Expo Go).",
      );
    } finally {
      setNotifBusy(false);
    }
  }, [notifBusy, set, userId]);

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="A couple of permissions"
        subtitle="Both are optional and you can change them later in Settings."
      />
      <PermissionCard
        icon={Heart}
        iconColor={macro.fat}
        iconSoft={macroSoft.fat}
        title="Apple Health"
        body="Read your active energy and steps to refine your adaptive TDEE. Sloe does not write to Health."
        granted={state.healthGranted}
        busy={healthBusy}
        errorMessage={healthError}
        onAllow={() => void onAllowHealth()}
        onSkip={() => {
          set({ healthGranted: false });
          setHealthError(null);
        }}
      />
      <PermissionCard
        icon={Bell}
        iconColor={Accent.warning}
        iconSoft={warningSoft}
        title="Notifications"
        body="Gentle reminders only — an evening nudge when you're off-target, plus a Sunday recap of your week."
        granted={state.notifGranted}
        busy={notifBusy}
        errorMessage={notifError}
        onAllow={() => void onAllowNotifications()}
        onSkip={() => {
          set({ notifGranted: false });
          setNotifError(null);
          // Informed decision — don't re-prompt via /notifications-prompt.
          void markNotificationsPromptDismissed();
        }}
      />
    </MobileStepBody>
  );
}

function PermissionCard({
  icon: Icon,
  iconColor,
  iconSoft,
  title,
  body,
  granted,
  busy = false,
  errorMessage = null,
  onAllow,
  onSkip,
}: {
  icon: LucideIcon;
  iconColor: string;
  /** The icon hue's FAMILY `*Soft` token for the glyph disc (ENG-1521 —
   *  replaces the old `iconColor + "26"` alpha-concat). */
  iconSoft: string;
  title: string;
  body: string;
  granted: boolean | null;
  busy?: boolean;
  errorMessage?: string | null;
  onAllow: () => void;
  onSkip: () => void;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the "Allow" CTA + the
  // "Undo / Try again" link. The card's per-permission glyph (Health = fat,
  // Notifications = warning), the granted border/badge (`Accent.success*`), and
  // the disabled state keep their own tokens.
  const accent = useAccent();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: CARD_RADIUS,
        padding: 16,
        marginBottom: Spacing.dense,
        borderWidth: 1,
        borderColor: granted === true ? Accent.successLight : colors.border, // ENG-1572 — solid Light, no alpha
      }}
    >
      <View
        style={{ flexDirection: "row", gap: Spacing.dense, alignItems: "flex-start", marginBottom: Spacing.dense }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: Radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconSoft,
          }}
        >
          <Icon size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: Type.bodyLarge.fontFamily,
              fontSize: Type.bodyLarge.fontSize,
              lineHeight: Type.bodyLarge.lineHeight,
              fontWeight: "700",
              color: colors.text,
              letterSpacing: -0.2,
            }}
          >
            {title}
          </Text>
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
      {granted === true ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Check size={14} color={Accent.successLight} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: Accent.successLight }}>
            Allowed
          </Text>
        </View>
      ) : granted === false ? (
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense }}>
            <Text style={{ ...Type.captionSmall, color: colors.textSecondary, flex: 1 }}>
              {errorMessage ?? "Skipped — you can allow later"}
            </Text>
            <Pressable onPress={onAllow} disabled={busy}>
              <Text
                style={{
                  fontFamily: Type.captionSmall.fontFamily,
                  fontSize: Type.captionSmall.fontSize,
                  lineHeight: Type.captionSmall.lineHeight,
                  fontWeight: "700",
                  color: busy ? colors.textTertiary : accent.primaryLight,
                }}
              >
                {busy ? "Asking…" : errorMessage ? "Try again" : "Undo"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: Spacing.dense }}>
          <Pressable
            onPress={onAllow}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Allow"
            accessibilityState={{ disabled: busy }}
            style={({ pressed }) => ({
              flex: 1,
              height: 40,
              borderRadius: 12,
              backgroundColor: accent.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: accent.primaryForeground, fontSize: 13, fontWeight: "700" }}>
              {busy ? "Asking…" : "Allow"}
            </Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Not now"
            style={({ pressed }) => ({
              flex: 1,
              height: 40,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy ? 0.6 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
              Not now
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
