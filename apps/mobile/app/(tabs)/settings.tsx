import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth";
import { useTheme, type ThemePreference } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
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

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "Automatic", value: "auto" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const colors = useThemeColors();
  const { preference, setPreference } = useTheme();

  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        scrollContent: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: 120,
          gap: Spacing.md,
        },
        title: { fontSize: 28, fontWeight: "800", color: colors.text },
        sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
        muted: { color: colors.textSecondary, paddingHorizontal: Spacing.xl },
        center: { paddingVertical: 40, alignItems: "center" },
        err: { color: "#f87171", fontSize: 14 },
        card: {
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: Neon.pink + "30",
          backgroundColor: colors.card,
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
          borderBottomColor: colors.border,
        },
        rowLast: { borderBottomWidth: 0 },
        rowLabel: { flex: 1, paddingRight: 8, color: colors.text, fontSize: 15, lineHeight: 20 },
        saving: { color: colors.textTertiary, fontSize: 13 },
        sectionTitle: {
          fontSize: 13,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginTop: Spacing.md,
        },
        segmentedRow: {
          flexDirection: "row",
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        },
        segmentBtn: {
          flex: 1,
          paddingVertical: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.card,
        },
        segmentBtnActive: {
          backgroundColor: Neon.purple + "20",
          borderColor: Neon.purple,
        },
        segmentBtnText: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.textSecondary,
        },
        segmentBtnTextActive: {
          color: Neon.purple,
        },
      }),
    [colors],
  );

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
        setError("Couldn't load notification settings.");
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
      if (uErr) setError("Couldn't save settings. Try again.");
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

        {/* Theme section */}
        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.segmentedRow}>
          {THEME_OPTIONS.map((opt, idx) => {
            const isActive = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.segmentBtn,
                  isActive && styles.segmentBtnActive,
                  idx > 0 && { borderLeftWidth: 1, borderLeftColor: colors.border },
                ]}
                onPress={() => setPreference(opt.value)}
              >
                <Text style={[styles.segmentBtnText, isActive && styles.segmentBtnTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Neon.purple} />
          </View>
        ) : (
          <>
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.card}>
              <Row
                label="New recipes from people you follow"
                value={prefs.newRecipes}
                onToggle={() => toggle("newRecipes")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <Row
                label="Meal plan ready"
                value={prefs.mealReminders}
                onToggle={() => toggle("mealReminders")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <Row
                label="Weekly summary"
                value={prefs.weeklyReport}
                onToggle={() => toggle("weeklyReport")}
                disabled={saving}
                styles={styles}
                colors={colors}
              />
              <Row
                label="Your recipe publish updates"
                value={prefs.creatorUpdates}
                onToggle={() => toggle("creatorUpdates")}
                disabled={saving}
                isLast
                styles={styles}
                colors={colors}
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
  styles: Record<string, any>;
  colors: { text: string; textTertiary: string; border: string };
}) {
  return (
    <View style={[props.styles.row, props.isLast && props.styles.rowLast]}>
      <Text style={props.styles.rowLabel}>{props.label}</Text>
      <Switch
        value={props.value}
        onValueChange={() => props.onToggle()}
        disabled={props.disabled}
        trackColor={{ false: props.colors.border, true: Neon.purple + "99" }}
        thumbColor={props.value ? props.colors.text : props.colors.textTertiary}
        ios_backgroundColor={props.colors.border}
      />
    </View>
  );
}
