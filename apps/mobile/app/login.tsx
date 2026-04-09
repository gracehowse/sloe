import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Redirect } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!hasSupabaseConfig()) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Sign in</ThemedText>
        <ThemedText style={styles.warn}>
          Sign-in isn’t configured for this build yet. Please use the web app, or contact the person who set up this
          app.
        </ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return <ThemedView style={styles.container} />;
  }

  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSignIn() {
    setMessage(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Platemate</ThemedText>
      <ThemedText style={styles.sub}>Sign in with the same email and password as the web app.</ThemedText>

      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={() => void onSignIn()} disabled={busy}>
        <ThemedText type="defaultSemiBold" style={styles.btnText}>
          {busy ? "Signing in…" : "Sign in"}
        </ThemedText>
      </Pressable>

      {message ? <ThemedText style={styles.err}>{message}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, justifyContent: "center" },
  sub: { opacity: 0.85, marginBottom: 8 },
  warn: { color: "#b45309" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
  },
  btn: {
    backgroundColor: "#7c3aed",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff" },
  err: { color: "#b91c1c", marginTop: 8 },
});
