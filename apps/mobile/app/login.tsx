import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { Neon, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export default function LoginScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      backgroundColor: Neon.purple,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.lg,
      shadowColor: Neon.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
    },
    brandLetter: { color: "#fff", fontSize: 32, fontWeight: "800" },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: Neon.purple,
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
      backgroundColor: Neon.purple,
      paddingVertical: 16,
      borderRadius: Radius.md,
      alignItems: "center",
      marginTop: Spacing.sm,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
    errorText: { color: Neon.red, fontSize: 13, textAlign: "center" },
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
        <Text style={styles.title}>PLATEMATE</Text>
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
        if (error) setMessage(error.message);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          // If user doesn't exist, suggest sign up
          if (error.message.includes("Invalid login")) {
            setMessage("No account found. Tap 'Create account' below to sign up.");
          } else {
            setMessage(error.message);
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAppleSignIn() {
    setMessage(null);
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        setMessage("Apple Sign-In failed — no identity token received.");
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) setMessage(error.message);
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        setMessage("Apple Sign-In failed. Try email instead.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Brand */}
      <View style={styles.brandSection}>
        <View style={styles.brandCircle}>
          <Text style={styles.brandLetter}>P</Text>
        </View>
        <Text style={styles.title}>PLATEMATE</Text>
        <Text style={styles.tagline}>Meal plans that hit your macros</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.tabIconDefault}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.tabIconDefault}
          value={password}
          onChangeText={setPassword}
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
            if (error) { setMessage(error.message); return; }
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
            if (error) { setMessage(error.message); return; }
            setMessage("Magic link sent! Check your email inbox.");
          }}>
            <Text style={[styles.hint, { color: Neon.purple }]}>Sign in with magic link</Text>
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
