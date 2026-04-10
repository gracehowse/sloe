import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";

type NotificationPrefs = {
  newRecipes: boolean;
  mealReminders: boolean;
  weeklyReport: boolean;
  creatorUpdates: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  newRecipes: true,
  mealReminders: false,
  weeklyReport: true,
  creatorUpdates: true,
};

export default function SettingsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("notification_prefs")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (qErr) {
        setError("Couldn’t load notification settings.");
      } else {
        const raw = (data as { notification_prefs?: unknown } | null)?.notification_prefs;
        if (raw && typeof raw === "object") {
          setPrefs({ ...DEFAULT_PREFS, ...(raw as Partial<NotificationPrefs>) });
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(
    async (next: NotificationPrefs) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      const { error: uErr } = await supabase.from("profiles").update({ notification_prefs: next }).eq("id", userId);
      setSaving(false);
      if (uErr) setError("Couldn’t save settings. Try again.");
    },
    [userId],
  );

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      void persist(next);
      return next;
    });
  };

  if (!userId) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Sign in to manage settings.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.heading}>
        Settings
      </ThemedText>
      <ThemedText style={styles.sub}>Notification preferences sync with your account.</ThemedText>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <>
          {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
          <View style={styles.card}>
            <Row
              label="New recipes from people you follow"
              value={prefs.newRecipes}
              onToggle={() => toggle("newRecipes")}
              disabled={saving}
            />
            <Row
              label="Meal plan ready"
              value={prefs.mealReminders}
              onToggle={() => toggle("mealReminders")}
              disabled={saving}
            />
            <Row
              label="Weekly summary"
              value={prefs.weeklyReport}
              onToggle={() => toggle("weeklyReport")}
              disabled={saving}
            />
            <Row
              label="Your recipe publish updates"
              value={prefs.creatorUpdates}
              onToggle={() => toggle("creatorUpdates")}
              disabled={saving}
            />
          </View>
          {saving ? (
            <ThemedText style={styles.saving}>Saving…</ThemedText>
          ) : null}
        </>
      )}
    </ThemedView>
  );
}

function Row(props: {
  label: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{props.label}</ThemedText>
      <Switch
        value={props.value}
        onValueChange={() => props.onToggle()}
        disabled={props.disabled}
        trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }}
        thumbColor={props.value ? "#7c3aed" : "#f4f4f5"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  heading: { marginBottom: 4 },
  sub: { opacity: 0.8, marginBottom: 8 },
  center: { paddingVertical: 40, alignItems: "center" },
  err: { color: "#b91c1c" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  rowLabel: { flex: 1, paddingRight: 8 },
  saving: { opacity: 0.7, fontSize: 13 },
});
