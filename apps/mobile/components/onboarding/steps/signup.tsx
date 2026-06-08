import * as React from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { sha256 } from "js-sha256";
import { Ionicons } from "@expo/vector-icons";
import { Accent, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { useOnboarding } from "../context";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

/**
 * MobileSignupStep — onboarding v2 step 02. Apple Sign-In is the
 * primary (and currently only) path on iOS per App Store guidelines.
 *
 * MV-02 fix (audit 2026-04-28): pre-fix the Apple button was a fake
 * — `set({ authMethod: "apple" }); go(1)` set a string in state and
 * advanced. No native sheet, no Supabase session, no nonce. The user
 * then walked through 12 more steps anonymous and the terminal-step
 * completion handler hit the unauthenticated guard. Now wires the
 * real `expo-apple-authentication` flow + `signInWithIdToken`,
 * mirroring `apps/mobile/app/login.tsx#onAppleSignIn`.
 *
 * ENG-672 fix (2026-05-26): two defects fixed here.
 *   1. The post-sign-in `go(1)` is REMOVED. Advancing past Signup is
 *      now owned exclusively by the flow shell's auto-skip effect,
 *      which fires only once a real `session` lands in the auth
 *      context (`mobile-flow.tsx`). The old `go(1)` could advance
 *      before the session resolved, letting the user complete the
 *      flow unauthenticated and lose every answer on the terminal
 *      /login bounce. The shared `canAdvance("signup", …)` gate now
 *      keeps the footer Continue disabled until `hasSession` is true.
 *   2. The email field is GONE. It advertised an email path that
 *      didn't exist ("arrives in a future build" buried in fine
 *      print) — a trust-killer for MFP refugees. Until real email
 *      sign-up ships, Apple Sign-In is surfaced as the single, honest
 *      path. `name` is still captured (optional) so Apple's
 *      first-sign-in fullName isn't the only source for
 *      `display_name`.
 */
function createAppleRawNonce(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function MobileSignupStep() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const appleAvailable = Platform.OS === "ios";

  const onAppleSignIn = React.useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const rawNonce = createAppleRawNonce();
      const hashedNonce = sha256(rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setError("Apple Sign-In failed — no identity token received.");
        return;
      }
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      // ENG-671: fire signup event — this step is onboarding-only so it's
      // always a new account creation, not a returning sign-in.
      try {
        track(AnalyticsEvents.user_signed_up, { method: "apple", platform: "mobile" });
      } catch { /* analytics never blocks the user */ }
      // Capture the Apple-provided name into state so the persist call
      // has something to write into `profiles.display_name`. Apple only
      // sends fullName on the FIRST sign-in for the user; subsequent
      // sign-ins return null. If we're missing on this call, the
      // existing `state.name` field stays whatever the user typed (or
      // empty — the persist helper falls back to email-prefix).
      const fullName = credential.fullName?.givenName ?? null;
      if (fullName && !state.name) {
        set({ name: fullName, authMethod: "apple" });
      } else {
        set({ authMethod: "apple" });
      }
      // ENG-672 (2026-05-26): do NOT advance here. Advancing past
      // Signup is owned by the flow shell's auto-skip effect, which
      // fires only once the real `session` lands in the auth context
      // (`mobile-flow.tsx`). The old `go(1)` could fire before the
      // session resolved — letting the user proceed unauthenticated and
      // lose every answer on the terminal /login bounce. The session is
      // the single gate now: when it resolves, the shell advances; if it
      // never lands (auth failure / timeout), the user stays right here
      // with all their answers intact and can retry Apple Sign-In.
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "ERR_REQUEST_CANCELED") return;
      setError(e instanceof Error ? e.message : "Apple Sign-In failed.");
    } finally {
      setBusy(false);
    }
  }, [set, state.name]);

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="Create your account"
        subtitle="One account, same data on your phone and on the web."
      />

      {appleAvailable ? (
        <Pressable
          onPress={() => void onAppleSignIn()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple"
          accessibilityState={{ disabled: busy }}
          style={({ pressed }) => ({
            height: 48,
            borderRadius: 12,
            backgroundColor: "#000",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 16,
            opacity: busy ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                Sign in with Apple
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      {error ? (
        <View
          style={{
            backgroundColor: Accent.destructive + "15",
            borderColor: Accent.destructive + "40",
            borderWidth: 1,
            borderRadius: Radius.md,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 12, color: Accent.destructive, lineHeight: 17 }}>
            {error}
          </Text>
        </View>
      ) : null}

      {/* Optional first name. ENG-672 (2026-05-26): the email field was
          removed — it advertised a sign-up path that doesn't exist yet.
          Apple Sign-In above is the single, honest path. First name is
          optional: Apple sends `fullName` only on the FIRST sign-in, so
          capturing it here gives the persist helper a fallback for
          `display_name` if the user has signed in with Apple before. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginVertical: 16,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Text
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            fontWeight: "600",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Optional
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>

      <LabelledField
        label="First name"
        value={state.name}
        onChange={(v) => set({ name: v })}
        placeholder="Grace"
      />

      <Text
        style={{
          fontSize: 11,
          color: colors.textTertiary,
          marginTop: 16,
          lineHeight: 17,
        }}
      >
        By signing in with Apple you agree to Sloe&apos;s Terms and Privacy
        Policy. Email sign-up is coming soon.
      </Text>
    </MobileStepBody>
  );
}

function LabelledField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: Radius.md,
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 1,
          color: colors.textTertiary,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "words"}
        style={{
          fontSize: 16,
          color: colors.text,
          paddingVertical: 0,
        }}
      />
    </View>
  );
}
