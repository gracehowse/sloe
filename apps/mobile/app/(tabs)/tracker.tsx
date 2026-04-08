import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Constants from "expo-constants";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth";
import { dateKeyFromDate, newMealId, type ByDay, type JournalMeal } from "@/lib/nutritionJournal";
import { supabase } from "@/lib/supabase";

function apiBase(): string {
  const extra = Constants.expoConfig?.extra as { platemateApiUrl?: string } | undefined;
  return (extra?.platemateApiUrl ?? "").replace(/\/$/, "");
}

function todayKey(): string {
  return dateKeyFromDate(new Date());
}

function formatTimeLabel(): string {
  try {
    return new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "12:00 PM";
  }
}

export default function TrackerScreen() {
  const base = useMemo(() => apiBase(), []);
  const { session } = useAuth();
  const userId = session?.user.id;

  const [byDay, setByDay] = useState<ByDay>({});
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [kcal, setKcal] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const dayKey = todayKey();

  const mealsToday = byDay[dayKey] ?? [];

  const totals = useMemo(() => {
    return mealsToday.reduce(
      (acc, m) => ({
        calories: acc.calories + Math.max(0, m.calories),
        protein: acc.protein + Math.max(0, m.protein),
        carbs: acc.carbs + Math.max(0, m.carbs),
        fat: acc.fat + Math.max(0, m.fat),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [mealsToday]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("nutrition_journals")
        .select("by_day")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
        setHydrated(true);
        return;
      }
      if (data?.by_day && typeof data.by_day === "object") {
        setByDay(data.by_day as ByDay);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !hydrated) return;
    const t = setTimeout(() => {
      void supabase
        .from("nutrition_journals")
        .upsert(
          { user_id: userId, updated_at: new Date().toISOString(), by_day: byDay },
          { onConflict: "user_id" },
        )
        .then(({ error }) => {
          if (error) {
            setNote(`Sync issue: ${error.message}`);
          }
        });
    }, 600);
    return () => clearTimeout(t);
  }, [userId, hydrated, byDay]);

  const addMeal = useCallback(() => {
    const n = Number(kcal);
    if (!Number.isFinite(n) || n <= 0) {
      setNote("Enter a positive calorie amount.");
      return;
    }
    const label = title.trim() || "Quick entry";
    const meal: JournalMeal = {
      id: newMealId(),
      name: "Snack",
      recipeTitle: label,
      time: formatTimeLabel(),
      calories: Math.round(n),
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    setByDay((prev) => {
      const day = prev[dayKey] ?? [];
      return { ...prev, [dayKey]: [...day, meal] };
    });
    setKcal("");
    setTitle("");
    setNote("Saved — syncing with Platemate web via Supabase.");
  }, [dayKey, kcal, title]);

  async function signOut() {
    setNote(null);
    await supabase.auth.signOut();
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title">Tracker</ThemedText>
        <ThemedText style={styles.sub}>
          Logged meals sync to your account — same data as the web Nutrition Tracker (Supabase{" "}
          <ThemedText type="defaultSemiBold">nutrition_journals</ThemedText>).
        </ThemedText>

        {base ? (
          <ThemedText style={styles.ok}>API URL (search/barcode): {base}</ThemedText>
        ) : (
          <ThemedText style={styles.warn}>
            Optional: set <ThemedText type="defaultSemiBold">expo.extra.platemateApiUrl</ThemedText> in app.json for
            hosted USDA search routes.
          </ThemedText>
        )}

        {loadError ? (
          <ThemedText style={styles.warn}>Could not load journal: {loadError}</ThemedText>
        ) : null}

        <View style={styles.card}>
          <ThemedText type="defaultSemiBold">Today ({dayKey})</ThemedText>
          <ThemedText style={styles.muted}>
            {totals.calories} kcal · {totals.protein}P · {totals.carbs}C · {totals.fat}F
          </ThemedText>
        </View>

        <ThemedText type="subtitle">Quick log</ThemedText>
        <TextInput
          placeholder="Label (optional)"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          keyboardType="number-pad"
          placeholder="Calories (kcal)"
          value={kcal}
          onChangeText={setKcal}
          style={styles.input}
        />
        <Pressable style={styles.btn} onPress={addMeal}>
          <ThemedText type="defaultSemiBold" style={styles.btnText}>
            Add to today
          </ThemedText>
        </Pressable>

        {mealsToday.length > 0 ? (
          <View style={styles.list}>
            {mealsToday.map((m) => (
              <View key={m.id} style={styles.row}>
                <ThemedText type="defaultSemiBold">{m.recipeTitle}</ThemedText>
                <ThemedText style={styles.muted}>
                  {m.calories} kcal · {m.time}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText style={styles.muted}>No meals logged yet today.</ThemedText>
        )}

        {note ? <ThemedText style={styles.note}>{note}</ThemedText> : null}

        <Pressable style={styles.outline} onPress={() => void signOut()}>
          <ThemedText type="defaultSemiBold">Sign out</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 10, paddingBottom: 40 },
  sub: { opacity: 0.85 },
  warn: { color: "#b45309", marginTop: 4 },
  ok: { opacity: 0.7, fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginVertical: 8,
  },
  muted: { opacity: 0.75, fontSize: 13 },
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
  },
  btnText: { color: "#fff" },
  list: { gap: 8, marginTop: 8 },
  row: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  note: { marginTop: 8, opacity: 0.85 },
  outline: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
  },
});
