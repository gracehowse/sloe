import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { authedFetch } from "@/lib/authedFetch";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

function apiBase(): string {
  const extra = Constants.expoConfig?.extra as { platemateApiUrl?: string } | undefined;
  return (extra?.platemateApiUrl ?? "").replace(/\/$/, "");
}

type Hit = { description?: string; fdcId?: number };

export default function SearchScreen() {
  const base = apiBase();
  const [q, setQ] = useState("apple");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const runSearch = async () => {
    if (!base) {
      setErr("Food search isn’t available in this build yet.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const url = `${base}/api/usda/search?q=${encodeURIComponent(q.trim())}`;
      const res = await authedFetch(url);
      const data = (await res.json()) as { hits?: Hit[]; ok?: boolean };
      if (!res.ok) {
        setErr("Search failed.");
        setHits([]);
        return;
      }
      setHits(Array.isArray(data.hits) ? data.hits.slice(0, 15) : []);
    } catch {
      setErr("Network error.");
      setHits([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Food search</ThemedText>
      <ThemedText style={styles.sub}>Search foods and log portions.</ThemedText>

      <View style={styles.row}>
        <TextInput value={q} onChangeText={setQ} placeholder="e.g. chicken breast" style={styles.input} />
        <Pressable style={styles.btn} onPress={() => void runSearch()}>
          {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.btnText}>Search</ThemedText>}
        </Pressable>
      </View>

      {err ? <ThemedText style={styles.err}>{err}</ThemedText> : null}

      <View style={styles.list}>
        {hits.map((h, i) => (
          <View key={`${h.fdcId ?? i}`} style={styles.item}>
            <ThemedText>{h.description ?? "(no name)"}</ThemedText>
            {h.fdcId != null ? (
              <ThemedText style={styles.meta}>FDC {h.fdcId}</ThemedText>
            ) : null}
          </View>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 10 },
  sub: { opacity: 0.85 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  btn: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    minWidth: 88,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  err: { color: "#b45309" },
  list: { marginTop: 12, gap: 8 },
  item: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  meta: { fontSize: 12, opacity: 0.6, marginTop: 4 },
});
