/**
 * `/reset-password` — landing screen for the password-recovery deep link
 * (ENG-1483).
 *
 * `login.tsx`'s "Forgot password?" called `resetPasswordForEmail` with
 * `redirectTo: AUTH_CALLBACK_DEEP_LINK` and no `next` param, so
 * `auth-callback.tsx` fell back to `safeAuthRedirectPath(undefined)` →
 * `/(tabs)` — a just-recovered user landed on the signed-in home with no
 * way to actually set a new password. Fixed by passing
 * `next=/reset-password` on the redirect (mirrors web's
 * `app/login/ui.tsx` `sendPasswordReset`) and adding this screen so the
 * link has somewhere real to land. Mirrors `app/reset-password/page.tsx`
 * (web) — password + confirm, `supabase.auth.updateUser`, redirect to
 * `/login` on success.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import KeyboardSafeView from "@/components/KeyboardSafeView";
import { PressableScale } from "@/components/ui/PressableScale";
import { SloeHeaderWordmark } from "@/components/SloeHeaderWordmark";

function formatResetError(err: unknown): string {
  const msg =
    err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "Something went wrong. Please try again.";
  return msg;
}

export default function ResetPasswordScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // The recovery session is established by `auth-callback.tsx` before it
  // routes here; confirm it landed before letting the user submit.
  useEffect(() => {
    void supabase.auth.getSession().then(() => setReady(true));
  }, []);

  async function onSubmit() {
    setMessage(null);
    if (password.length < 8) {
      setMessage("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(formatResetError(error));
        return;
      }
      router.replace("/login");
    } catch (e) {
      setMessage(formatResetError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <View style={[styles.container, styles.centerBody, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardSafeView
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.xl }]}
      style={{ backgroundColor: colors.background }}
    >
      <View style={styles.brandSection}>
        <SloeHeaderWordmark fontSize={40} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[Type.navTitle, { color: colors.text }]}>Reset password</Text>
        <Text style={[Type.bodyMuted, styles.subtitle, { color: colors.textSecondary }]}>
          Choose a new password for your account.
        </Text>

        <Text style={[Type.captionSmall, styles.label, { color: colors.text }]}>New password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
        />

        <Text style={[Type.captionSmall, styles.label, styles.labelSpaced, { color: colors.text }]}>
          Confirm password
        </Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Re-enter password"
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
        />

        {message && <Text style={[Type.captionSmall, styles.errorText]}>{message}</Text>}

        <PressableScale
          onPress={() => void onSubmit()}
          disabled={busy}
          haptic="confirm"
          style={[styles.btn, { backgroundColor: colors.tint }, busy && styles.btnDisabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={[Type.button, { color: colors.primaryForeground }]}>Update password</Text>
          )}
        </PressableScale>

        {/* Mirrors web's "Back to sign in" (ENG-86, audit 2026-04-30) — an
            exit for users who land here in error (stale link, didn't
            request a reset). */}
        <PressableScale onPress={() => router.replace("/login")} haptic="selection" style={styles.backRow}>
          <Text style={[Type.captionSmall, { color: colors.textSecondary }]}>← Back to sign in</Text>
        </PressableScale>
      </View>
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerBody: { alignItems: "center", justifyContent: "center" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  brandSection: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.xl,
  },
  subtitle: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  label: { marginBottom: Spacing.sm },
  labelSpaced: { marginTop: Spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  errorText: {
    color: Accent.destructive,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  btn: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.6 },
  backRow: {
    marginTop: Spacing.md,
    alignItems: "center",
  },
});
