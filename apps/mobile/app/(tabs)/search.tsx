import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { authedFetch } from "@/lib/authedFetch";
import { effectiveFoodSearchQuery } from "@suppr/shared/nutrition/foodSearchQuery";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

function apiBase(): string {
  const extra = Constants.expoConfig?.extra as { supprApiUrl?: string } | undefined;
  return (extra?.supprApiUrl ?? "").replace(/\/$/, "");
}

type Hit = { description?: string; fdcId?: number };

export default function SearchScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const base = apiBase();
  // 2026-05-13 (premium-bar audit Group J #19): default empty, not
  // pre-filled with "apple". The pre-fill demanded an immediate
  // backspace from any user who didn't actually want to search for
  // apples — the placeholder hint ("e.g. chicken breast") is enough.
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const runSearch = async () => {
    if (!base) {
      setErr("Food search isn't available in this build yet.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const searchQ = effectiveFoodSearchQuery(q.trim());
      if (!searchQ) {
        setErr("Enter a food name.");
        setBusy(false);
        return;
      }
      const url = `${base}/api/usda/search?q=${encodeURIComponent(searchQ)}`;
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

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: Spacing.xl, gap: Spacing.sm, backgroundColor: colors.background },
    title: { fontSize: 22, fontWeight: "700", color: colors.text },
    sub: { fontSize: 14, color: colors.textSecondary },
    row: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    btn: {
      backgroundColor: Accent.primary,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.md,
      justifyContent: "center",
      minWidth: 88,
      alignItems: "center",
    },
    btnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
    err: { color: Accent.warning, fontSize: 13 },
    list: { marginTop: Spacing.md, gap: Spacing.sm },
    item: {
      padding: Spacing.md,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    itemText: { fontSize: 14, color: colors.text },
    meta: { fontSize: 12, color: colors.textTertiary, marginTop: Spacing.xs },
  }), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <Text style={styles.title}>Food search</Text>
      <Text style={styles.sub}>Search foods and log portions.</Text>

      <View style={styles.row}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="e.g. chicken breast"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
        <Pressable style={styles.btn} onPress={() => void runSearch()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Search</Text>}
        </Pressable>
      </View>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <View style={styles.list}>
        {hits.map((h, i) => (
          <View key={`${h.fdcId ?? i}`} style={styles.item}>
            <Text style={styles.itemText}>{h.description ?? "(no name)"}</Text>
            {h.fdcId != null ? (
              <Text style={styles.meta}>FDC {h.fdcId}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}
