import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!session) { setOnboardingChecked(false); return; }
    supabase
      .from("profiles")
      .select("target_calories")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNeedsOnboarding(!data?.target_calories);
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
  }), [colors]);

  if (!hasSupabaseConfig()) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.title}>PLATEMATE</Text>
        <Text style={styles.errorText}>
          Sign-in isn't configured for this build. Use the web app or contact support.
        </Text>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.container} />;
  }

  if (session && onboardingChecked) {
    return <Redirect href={needsOnboarding ? "/profile" : "/(tabs)"} />;
  }
  if (session && !onboardingChecked) {
    return null;
  }

  async function onSignIn() {
    setMessage(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setMessage(error.message);
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
          onPress={() => void onSignIn()}
          disabled={busy}
        >
          <Text style={styles.btnText}>{busy ? "Signing in..." : "Sign In"}</Text>
        </Pressable>

        {message ? <Text style={styles.errorText}>{message}</Text> : null}

        <Text style={styles.hint}>
          Use the same email and password as the web app.
        </Text>
      </View>
    </View>
  );
}
