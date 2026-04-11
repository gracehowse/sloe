import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Neon, Radius, Spacing } from "@/constants/theme";

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
  const insets = useSafeAreaInsets();
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
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.muted}>Sign in to manage settings.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Notification preferences sync with your account.</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Neon.purple} />
          </View>
        ) : (
          <>
            {error ? <Text style={styles.err}>{error}</Text> : null}
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
                isLast
              />
            </View>
            {saving ? <Text style={styles.saving}>Saving…</Text> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row(props: {
  label: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.row, props.isLast && styles.rowLast]}>
      <Text style={styles.rowLabel}>{props.label}</Text>
      <Switch
        value={props.value}
        onValueChange={() => props.onToggle()}
        disabled={props.disabled}
        trackColor={{ false: "#2a2a36", true: Neon.purple + "99" }}
        thumbColor={props.value ? "#f8fafc" : "#64748b"}
        ios_backgroundColor="#2a2a36"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0a0a0f" },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#f8fafc" },
  sub: { color: "#94a3b8", fontSize: 14, lineHeight: 20 },
  muted: { color: "#94a3b8", paddingHorizontal: Spacing.xl },
  center: { paddingVertical: 40, alignItems: "center" },
  err: { color: "#f87171", fontSize: 14 },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Neon.pink + "30",
    backgroundColor: "#16161e",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1e1e2a",
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { flex: 1, paddingRight: 8, color: "#f8fafc", fontSize: 15, lineHeight: 20 },
  saving: { color: "#64748b", fontSize: 13 },
});
