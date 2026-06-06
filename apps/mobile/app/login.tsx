import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { sha256 } from "js-sha256";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { Accent, Spacing, Radius, Fonts } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import KeyboardSafeView from "@/components/KeyboardSafeView";
import { AppLaunchScreen } from "@/components/AppLaunchScreen";
import { SloeHeaderWordmark } from "@/components/SloeHeaderWordmark";

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

/** Maps Supabase / fetch failures to a short user-facing string. */
function formatAuthError(err: unknown): string {
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "Something went wrong. Please try again.";
  const lower = msg.toLowerCase();
  if (
    lower.includes("network") ||
    lower.includes("fetch") ||
    lower.includes("internet") ||
    lower.includes("failed to load") ||
    lower.includes("host lookup") ||
    lower.includes("connection")
  ) {
    return "Can't reach Suppr's servers. Try Wi‑Fi or cellular, turn off VPN or iCloud Private Relay, or confirm the Supabase project isn't paused.";
  }
  return msg;
}

export default function LoginScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  // Positive assent to Terms + Privacy required at account creation
  // (browsewrap is unenforceable — Nguyen v. Barnes & Noble). Defaults
  // to unchecked; never pre-check.
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  useEffect(() => {
    if (!session) { setOnboardingChecked(false); return; }
    let cancelled = false;
    const PROFILE_TIMEOUT_MS = 12_000;
    const timedOut = Symbol("profile_onboarding_timeout");
    (async () => {
      // Race so `finally` always runs: a hung PostgREST await never
      // resolves, which previously left `onboardingChecked` false and
      // this screen returning `null` (blank white).
      try {
        const result = await Promise.race([
          supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", session.user.id)
            .maybeSingle(),
          new Promise<typeof timedOut>((resolve) => {
            setTimeout(() => resolve(timedOut), PROFILE_TIMEOUT_MS);
          }),
        ]);
        if (cancelled) return;
        if (result === timedOut) {
          setNeedsOnboarding(false);
          return;
        }
        const { data } = result;
        setNeedsOnboarding(!data?.onboarding_completed);
      } catch {
        if (!cancelled) setNeedsOnboarding(false);
      } finally {
        if (!cancelled) setOnboardingChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      padding: Spacing.xxl,
    },
    brandSection: {
      alignItems: "center",
      marginBottom: Spacing.xxxl + Spacing.lg,
    },
    tagline: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: Spacing.sm,
    },
    form: { gap: Spacing.md },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 16,
    },
    btn: {
      backgroundColor: colors.tint,
      paddingVertical: 16,
      borderRadius: Radius.md,
      alignItems: "center",
      marginTop: Spacing.sm,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 17 },
    errorText: { color: Accent.destructive, fontSize: 13, textAlign: "center" },
    hint: {
      color: colors.tabIconDefault,
      fontSize: 13,
      textAlign: "center",
      marginTop: Spacing.sm,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: Spacing.md,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { paddingHorizontal: Spacing.md, color: colors.textTertiary, fontSize: 12 },
    appleBtn: {
      backgroundColor: "#000",
      paddingVertical: 16,
      borderRadius: Radius.md,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    appleBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    termsCheckbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    termsCheckboxChecked: {
      backgroundColor: colors.tint,
      borderColor: colors.tint,
    },
    termsText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    termsLink: { color: colors.text, textDecorationLine: "underline", fontWeight: "600" },
  }), [colors]);

  if (!hasSupabaseConfig()) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Suppr</Text>
        <Text style={styles.errorText}>
          {"Sign-in isn't configured for this build. Use the web app or contact support."}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  if (session && onboardingChecked) {
    return <Redirect href={needsOnboarding ? "/onboarding" : "/(tabs)"} />;
  }
  if (session && !onboardingChecked) {
    return <AppLaunchScreen message="Signing you in…" />;
  }

  async function onSubmit() {
    setMessage(null);
    const resolvedEmail = email.trim();
    const resolvedPassword = password;
    if (!resolvedEmail || !resolvedPassword) {
      setMessage("Enter your email and password.");
      return;
    }
    if (isSignUp && !acceptedTerms) {
      setMessage("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: resolvedEmail,
          password: resolvedPassword,
        });
        if (error) {
          setMessage(formatAuthError(error));
        } else {
          try { track(AnalyticsEvents.user_signed_up, { method: "email", platform: "mobile" }); } catch { /* ignore */ }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password: resolvedPassword,
        });
        if (error) {
          if (error.message.includes("Invalid login")) {
            setMessage("No account found. Tap 'Create account' below to sign up.");
          } else {
            setMessage(formatAuthError(error));
          }
        } else {
          try { track(AnalyticsEvents.user_signed_in, { method: "email", platform: "mobile" }); } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setMessage(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onAppleSignIn() {
    setMessage(null);
    if (isSignUp && !acceptedTerms) {
      setMessage("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    try {
      // Apple expects SHA256(rawNonce) on the request; Supabase verifies the ID token using rawNonce.
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
        setMessage("Apple Sign-In failed — no identity token received.");
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (error) {
        setMessage(formatAuthError(error));
      } else {
        // Login screen Apple button is always sign-in (returning users);
        // new-user Apple sign-up goes through the onboarding signup step.
        try { track(AnalyticsEvents.user_signed_in, { method: "apple", platform: "mobile" }); } catch { /* ignore */ }
      }
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "ERR_REQUEST_CANCELED") return;
      setMessage(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardSafeView
      contentContainerStyle={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Brand */}
      <View style={styles.brandSection}>
        <SloeHeaderWordmark fontSize={40} />
        <Text style={styles.tagline}>Sign in to Sloe</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          ref={emailRef}
          testID="login-email"
          accessibilityLabel="Email input"
          autoFocus
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="none"
          autoComplete="off"
          returnKeyType="next"
          placeholder="Email"
          placeholderTextColor={colors.tabIconDefault}
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => passwordRef.current?.focus()}
          style={styles.input}
        />
        <TextInput
          ref={passwordRef}
          testID="login-password"
          accessibilityLabel="Password input"
          textContentType="none"
          autoComplete="off"
          returnKeyType="go"
          placeholder="Password"
          placeholderTextColor={colors.tabIconDefault}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void onSubmit()}
          secureTextEntry
          style={styles.input}
        />

        {isSignUp && (
          <Pressable
            onPress={() => setAcceptedTerms((v) => !v)}
            style={styles.termsRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="Agree to Terms of Service and Privacy Policy"
          >
            <View style={[styles.termsCheckbox, acceptedTerms && styles.termsCheckboxChecked]}>
              {acceptedTerms ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the{" "}
              <Text style={styles.termsLink} onPress={() => void Linking.openURL("https://suppr-club.com/terms")}>
                Terms of Service
              </Text>
              {" "}and{" "}
              <Text style={styles.termsLink} onPress={() => void Linking.openURL("https://suppr-club.com/privacy")}>
                Privacy Policy
              </Text>
              .
            </Text>
          </Pressable>
        )}

        <Pressable
          testID="login-submit"
          style={[styles.btn, (busy || (isSignUp && !acceptedTerms)) && styles.btnDisabled]}
          onPress={() => void onSubmit()}
          disabled={busy || (isSignUp && !acceptedTerms)}
        >
          <Text style={styles.btnText}>{busy ? (isSignUp ? "Creating account..." : "Signing in...") : (isSignUp ? "Create Account" : "Sign In")}</Text>
        </Pressable>

        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <Pressable onPress={() => { setIsSignUp((v) => !v); setMessage(null); }}>
          <Text style={styles.hint}>
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
          </Text>
        </Pressable>

        {!isSignUp && (
          <Pressable onPress={async () => {
            if (!email.trim()) { setMessage("Enter your email first, then tap Forgot password."); return; }
            setBusy(true);
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
            setBusy(false);
            if (error) { setMessage(formatAuthError(error)); return; }
            setMessage("Password reset email sent. Check your inbox.");
          }}>
            <Text style={[styles.hint, { marginTop: 0 }]}>Forgot password?</Text>
          </Pressable>
        )}

        {!isSignUp && (
          <Pressable onPress={async () => {
            if (!email.trim()) { setMessage("Enter your email to receive a magic link."); return; }
            setBusy(true);
            const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
            setBusy(false);
            if (error) { setMessage(formatAuthError(error)); return; }
            setMessage("Magic link sent! Check your email inbox.");
          }}>
            <Text style={[styles.hint, { color: colors.text, fontWeight: "600" }]}>Sign in with magic link</Text>
          </Pressable>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Apple Sign-In — hidden when capability not provisioned (e.g. Personal Team dev build) */}
        {Platform.OS === "ios" && appleAuthAvailable && (
          <Pressable
            style={[styles.appleBtn, (busy || (isSignUp && !acceptedTerms)) && styles.btnDisabled]}
            onPress={() => void onAppleSignIn()}
            disabled={busy || (isSignUp && !acceptedTerms)}
          >
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={styles.appleBtnText}>Continue with Apple</Text>
          </Pressable>
        )}
      </View>
    </KeyboardSafeView>
  );
}
