import { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Constants from "expo-constants";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

function apiBase(): string {
  const extra = Constants.expoConfig?.extra as { platemateApiUrl?: string } | undefined;
  return (extra?.platemateApiUrl ?? "").replace(/\/$/, "");
}

export default function TrackerScreen() {
  const base = useMemo(() => apiBase(), []);
  const [kcal, setKcal] = useState("");
  const [note, setNote] = useState<string | null>(null);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Tracker</ThemedText>
      <ThemedText style={styles.sub}>
        Log calories for today. Data stays on-device until you connect the hosted Platemate API.
      </ThemedText>

      {!base ? (
        <ThemedText style={styles.warn}>
          Set{" "}
          <ThemedText type="defaultSemiBold">expo.extra.platemateApiUrl</ThemedText> in app.json to your Next.js URL
          to sync with the web app.
        </ThemedText>
      ) : (
        <ThemedText style={styles.ok}>API: {base}</ThemedText>
      )}

      <TextInput
        keyboardType="number-pad"
        placeholder="Calories (kcal)"
        value={kcal}
        onChangeText={setKcal}
        style={styles.input}
      />
      <Pressable
        style={styles.btn}
        onPress={() => {
          const n = Number(kcal);
          if (!Number.isFinite(n) || n <= 0) {
            setNote("Enter a positive number.");
            return;
          }
          setNote(`Saved locally: ${Math.round(n)} kcal (wire to Supabase in a follow-up).`);
        }}
      >
        <ThemedText type="defaultSemiBold" style={styles.btnText}>
          Save entry
        </ThemedText>
      </Pressable>
      {note ? <ThemedText style={styles.note}>{note}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  sub: { opacity: 0.85 },
  warn: { color: "#b45309", marginTop: 4 },
  ok: { opacity: 0.7, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  btn: {
    backgroundColor: "#7c3aed",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: "#fff" },
  note: { marginTop: 8, opacity: 0.85 },
});
