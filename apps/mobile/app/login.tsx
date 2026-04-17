import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { sha256 } from "js-sha256";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

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
    return "Can't reach the server. Check your connection and try again.";
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

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
  }, []);

  useEffect(() => {
    if (!session) { setOnboardingChecked(false); return; }
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNeedsOnboarding(!data?.onboarding_completed);
        setOnboardingChecked(true);
      });
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
    brandCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: Accent.primary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.lg,
      shadowColor: Accent.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
    },
    brandLetter: { color: "#fff", fontSize: 32, fontWeight: "800" },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: Accent.primary,
      letterSpacing: 4,
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
      backgroundColor: Accent.primary,
      paddingVertical: 16,
      borderRadius: Radius.md,
      alignItems: "center",
      marginTop: Spacing.sm,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
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
  }), [colors]);

  if (!hasSupabaseConfig()) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.title}>SUPPR</Text>
        <Text style={styles.errorText}>
          {"Sign-in isn't configured for this build. Use the web app or contact support."}
        </Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.container} />;
  }

  if (session && onboardingChecked) {
    return <Redirect href={needsOnboarding ? "/onboarding" : "/(tabs)"} />;
  }
  if (session && !onboardingChecked) {
    return null;
  }

  async function onSubmit() {
    setMessage(null);
    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) setMessage(formatAuthError(error));
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.message.includes("Invalid login")) {
            setMessage("No account found. Tap 'Create account' below to sign up.");
          } else {
            setMessage(formatAuthError(error));
          }
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
      if (error) setMessage(formatAuthError(error));
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? (e as { code?: string }).code : undefined;
      if (code === "ERR_REQUEST_CANCELED") return;
      setMessage(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Brand */}
      <View style={styles.brandSection}>
        <View style={styles.brandCircle}>
          <Text style={styles.brandLetter}>S</Text>
        </View>
        <Text style={styles.title}>SUPPR</Text>
        <Text style={styles.tagline}>Meal plans that hit your macros</Text>
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

        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          onPress={() => void onSubmit()}
          disabled={busy}
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
            <Text style={[styles.hint, { color: Accent.primary }]}>Sign in with magic link</Text>
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
            style={[styles.appleBtn, busy && styles.btnDisabled]}
            onPress={() => void onAppleSignIn()}
            disabled={busy}
          >
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={styles.appleBtnText}>Continue with Apple</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
