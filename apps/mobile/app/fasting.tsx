import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type FastingSession = { start: string; end: string | null };

const RING_SIZE = 220;
const STROKE = 14;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const MAX_SESSIONS = 90;

function parseFastingWindow(window: string): { fastHours: number; eatHours: number } {
  const parts = window.split(":");
  if (parts.length === 2) {
    const fast = parseInt(parts[0], 10);
    const eat = parseInt(parts[1], 10);
    if (!isNaN(fast) && !isNaN(eat)) return { fastHours: fast, eatHours: eat };
  }
  return { fastHours: 16, eatHours: 8 };
}

function formatDuration(ms: number): { hours: number; minutes: number; seconds: number; display: string } {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { hours, minutes, seconds, display: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` };
}

export default function FastingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();

  const [fastingWindow, setFastingWindow] = useState("16:8");
  const [sessions, setSessions] = useState<FastingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeFast = useMemo(
    () => sessions.find((s) => s.end === null) ?? null,
    [sessions],
  );

  const { fastHours, eatHours } = parseFastingWindow(fastingWindow);
  const fastMs = fastHours * 3600_000;

  const elapsed = activeFast ? now - new Date(activeFast.start).getTime() : 0;
  const pct = activeFast ? Math.min(1, elapsed / fastMs) : 0;
  const isFasting = !!activeFast;
  const isComplete = pct >= 1;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("fasting_window, fasting_sessions")
        .eq("id", userId)
        .maybeSingle();
      if (data?.fasting_window) setFastingWindow(data.fasting_window);
      if (Array.isArray(data?.fasting_sessions)) setSessions(data.fasting_sessions);
      setLoading(false);
    })();
  }, [userId]);

  useEffect(() => {
    if (activeFast) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [!!activeFast]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(pct, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  const persist = useCallback(async (next: FastingSession[]) => {
    if (!userId) return;
    const pruned = next.slice(-MAX_SESSIONS);
    setSessions(pruned);
    await supabase.from("profiles").update({ fasting_sessions: pruned }).eq("id", userId);
  }, [userId]);

  const startFast = useCallback(() => {
    const s: FastingSession = { start: new Date().toISOString(), end: null };
    persist([...sessions, s]);
    setNow(Date.now());
  }, [sessions, persist]);

  const endFast = useCallback(() => {
    if (!activeFast) return;
    const updated = sessions.map((s) =>
      s.start === activeFast.start ? { ...s, end: new Date().toISOString() } : s,
    );
    persist(updated);
  }, [sessions, activeFast, persist]);

  const recentCompleted = useMemo(
    () => sessions.filter((s) => s.end !== null).slice(-7).reverse(),
    [sessions],
  );

  const dur = formatDuration(elapsed);

  const ringColor = isComplete ? Accent.success : Accent.primary;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
        backBtn: { padding: 4 },
        title: { flex: 1, fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
        card: {
          marginHorizontal: Spacing.xl,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.xl,
          marginBottom: Spacing.lg,
        },
        label: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, letterSpacing: 1, textAlign: "center" },
        stateLabel: { fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: Spacing.sm },
        windowLabel: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 4 },
        btn: {
          marginHorizontal: Spacing.xl,
          paddingVertical: 16,
          borderRadius: Radius.md,
          alignItems: "center",
          marginBottom: Spacing.lg,
        },
        btnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
        historyTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: Spacing.sm },
        histRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
        histDate: { fontSize: 13, color: colors.textSecondary },
        histDuration: { fontSize: 13, fontWeight: "600", color: colors.text },
      }),
    [colors],
  );

  if (loading) return <View style={[styles.container, { paddingTop: insets.top }]} />;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Intermittent Fasting</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Timer ring */}
      <View style={[styles.card, { alignItems: "center" }]}>
        <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={R}
              stroke={ringColor} strokeWidth={STROKE} fill="none"
              strokeDasharray={`${CIRC}`} animatedProps={animatedProps}
              strokeLinecap="round" rotation="-90" origin={`${RING_SIZE / 2},${RING_SIZE / 2}`}
            />
          </Svg>
          <Text style={{ fontSize: 40, fontWeight: "800", color: isFasting ? colors.text : colors.textTertiary, fontVariant: ["tabular-nums"] }}>
            {isFasting ? dur.display : "—"}
          </Text>
        </View>

        <Text style={[styles.stateLabel, { color: isFasting ? (isComplete ? Accent.success : Accent.primary) : colors.textSecondary }]}>
          {isFasting ? (isComplete ? "FAST COMPLETE" : "FASTING") : "Tap Start to begin"}
        </Text>
        <Text style={styles.windowLabel}>{fastHours}:{eatHours} — {fastHours}h fast, {eatHours}h eat</Text>

        {isFasting && (
          <View style={{ flexDirection: "row", justifyContent: "space-around", width: "100%", marginTop: Spacing.lg }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>
                {new Date(activeFast!.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={styles.label}>Started</Text>
            </View>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: Accent.success, fontVariant: ["tabular-nums"] }}>
                {new Date(new Date(activeFast!.start).getTime() + fastMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <Text style={styles.label}>Goal</Text>
            </View>
          </View>
        )}
      </View>

      {/* Start / End button */}
      <Pressable
        style={[styles.btn, { backgroundColor: isFasting ? (isComplete ? Accent.success : Accent.destructive) : Accent.primary }]}
        onPress={isFasting ? endFast : startFast}
      >
        <Text style={styles.btnText}>{isFasting ? (isComplete ? "Complete Fast" : "End Fast") : "Start Fast"}</Text>
      </Pressable>

      {/* History */}
      {recentCompleted.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.historyTitle}>Recent Fasts</Text>
          {recentCompleted.map((s) => {
            const startD = new Date(s.start);
            const endD = new Date(s.end!);
            const durMs = endD.getTime() - startD.getTime();
            const fd = formatDuration(durMs);
            return (
              <View key={s.start} style={styles.histRow}>
                <Text style={styles.histDate}>
                  {startD.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
                <Text style={styles.histDuration}>
                  {fd.hours}h {fd.minutes}m
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
