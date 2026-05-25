import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "@/hooks/use-safe-back";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { useHaptics } from "@/hooks/useHaptics";
import { Ionicons } from "@expo/vector-icons";
import { Timer } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Accent, Spacing, Radius, Type } from "@/constants/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { fastingStageNarrative } from "@suppr/shared/nutrition/fastingStageNarrative";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type FastingSession = { start: string; end: string | null };

const RING_SIZE = 220;
const STROKE = 14;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const MAX_SESSIONS = 90;

/**
 * Window presets — kept in sync with the web FastingTimer
 * (`src/app/components/FastingTimer.tsx`) so the user sees the same
 * options regardless of platform. Order: 16:8 first (most common),
 * then ascending fast hours. Stored as the literal `"FF:EE"` string
 * in `profiles.fasting_window`.
 */
const WINDOW_PRESETS = ["16:8", "18:6", "20:4", "14:10"] as const;

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
  const goBack = useSafeBack("/(tabs)");
  const haptics = useHaptics();
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
    // Debug audit 2026-05-04 (code-quality #7): no try/catch and no
    // cancellation flag. A rejected select left the spinner up
    // permanently; on rapid userId change a stale resolution could
    // stomp the new state. Now: cancellation flag + try/finally so
    // loading always resolves and stale rows can't win.
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("fasting_window, fasting_sessions")
          .eq("id", userId)
          .maybeSingle();
        if (cancelled) return;
        if (data?.fasting_window) setFastingWindow(data.fasting_window);
        if (Array.isArray(data?.fasting_sessions)) setSessions(data.fasting_sessions);
      } catch (err) {
        if (typeof console !== "undefined") {
          console.warn("[fasting] load failed:", err instanceof Error ? err.message : err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  /**
   * Change the user's preferred fasting window. Persists to
   * `profiles.fasting_window` and updates the local state so the
   * ring + ETA + "Goal" timestamp re-render against the new fast
   * length immediately. Mirrors the web FastingTimer's `changeWindow`
   * — both platforms must accept the same preset strings so the
   * stored value round-trips between web and mobile.
   *
   * Pre-2026-05-02 there was no in-app way to change the window
   * after onboarding (Build 40 feedback: user typed "fast" in
   * Settings search → "No matches" with no other configure path).
   * This is the entry point that closes that gap.
   */
  const changeWindow = useCallback(
    (next: string) => {
      if (next === fastingWindow) return;
      haptics.select();
      setFastingWindow(next);
      if (!userId) return;
      void supabase
        .from("profiles")
        .update({ fasting_window: next })
        .eq("id", userId);
    },
    [fastingWindow, userId, haptics],
  );

  const startFast = useCallback(() => {
    const s: FastingSession = { start: new Date().toISOString(), end: null };
    persist([...sessions, s]);
    setNow(Date.now());
  }, [sessions, persist]);

  /**
   * 2026-05-14 premium-bar polish #4 — Fasting tab landing.
   * Quick-start the user's fast with a specific preset in one tap.
   * Sets the fasting window (persists to `profiles.fasting_window`)
   * and immediately starts a fast session. Used by the landing-card
   * chips (16:8 / 18:6) to remove the two-step "pick window then
   * tap Start Fast" hop for the most common journey. The Custom
   * chip opens an Alert listing the remaining web-parity presets
   * (20:4 / 14:10) since they live in the same data shape.
   */
  const quickStartFast = useCallback(
    (window: string) => {
      changeWindow(window);
      const s: FastingSession = { start: new Date().toISOString(), end: null };
      persist([...sessions, s]);
      setNow(Date.now());
    },
    [changeWindow, sessions, persist],
  );

  const openCustomWindowPicker = useCallback(() => {
    Alert.alert(
      "Pick a fasting window",
      "Custom presets — tap one to start a fast right away.",
      [
        { text: "20:4 (warrior)", onPress: () => quickStartFast("20:4") },
        { text: "14:10 (gentle)", onPress: () => quickStartFast("14:10") },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }, [quickStartFast]);

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
        title: { flex: 1, ...Type.headline, color: colors.text, textAlign: "center" },
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
        // ENG-52: stage-of-fasting narrative under the ring +
        // state-label. Tertiary colour to keep visual weight low —
        // it's contextual signal, not the headline.
        stageNarrative: {
          fontSize: 13,
          color: colors.textTertiary,
          textAlign: "center",
          marginTop: Spacing.sm,
          marginHorizontal: Spacing.xl,
          lineHeight: 18,
        },
        // Window picker — pill row matching the web FastingTimer
        // preset chips. Compact tabular-nums labels keep the four
        // pills visually balanced (`16:8` is narrower than `14:10`).
        presetRow: {
          flexDirection: "row",
          gap: 8,
          marginHorizontal: Spacing.xl,
          marginBottom: Spacing.lg,
          justifyContent: "center",
        },
        presetPill: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: Radius.md,
          borderWidth: 1,
        },
        presetPillText: {
          fontSize: 13,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        },
        presetHelp: {
          fontSize: 12,
          color: colors.textTertiary,
          textAlign: "center",
          marginHorizontal: Spacing.xl,
          marginBottom: Spacing.lg,
        },
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
    <ScrollView
      testID="screen-fasting"
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <PushScreenHeader title="Intermittent Fasting" onBack={goBack} />

      {/* 2026-05-14 premium-bar polish #4 — Fasting tab landing.
          When the user is NOT fasting, the screen shows a true
          "landing" card: large Timer glyph, headline, sub-copy,
          and quick-start chips (16:8 / 18:6 / Custom) that
          set+start in one tap. The full preset window picker
          remains below for users who want to change their default
          without starting. When the user IS fasting, the ring +
          live duration take over — same card geometry. */}
      {!isFasting ? (
        <View
          style={[styles.card, { alignItems: "center" }]}
          testID="fasting-landing"
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: Accent.primary + "15",
              marginBottom: Spacing.lg,
            }}
          >
            <Timer size={64} color={Accent.primary} strokeWidth={1.5} />
          </View>
          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: colors.text,
              textAlign: "center",
              marginBottom: Spacing.sm,
            }}
          >
            Fast when you&apos;re ready
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              textAlign: "center",
              lineHeight: 20,
              marginBottom: Spacing.lg,
              paddingHorizontal: Spacing.sm,
            }}
          >
            Intermittent fasting can help with weight management and metabolic
            health. Start a fast whenever you like.
          </Text>
          {/* Ready-when-you-are sub-label retained so the existing
              Maestro 13_fasting flow regex
              (Ready when you are|FASTING|FAST COMPLETE) keeps
              matching the not-fasting state. */}
          <Text style={[styles.stateLabel, { color: colors.textSecondary, marginTop: 0 }]}>
            Ready when you are
          </Text>
          <Text style={styles.windowLabel}>
            {fastHours}:{eatHours} — {fastHours}h fast, {eatHours}h eat
          </Text>

          <Pressable
            testID="fasting-landing-start"
            accessibilityRole="button"
            accessibilityLabel={`Start a ${fastingWindow} fast`}
            onPress={startFast}
            style={{
              marginTop: Spacing.lg,
              paddingVertical: 14,
              paddingHorizontal: 28,
              borderRadius: Radius.md,
              backgroundColor: Accent.primary,
              alignItems: "center",
              alignSelf: "stretch",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: Accent.primaryForeground }}>
              Start Fast
            </Text>
          </Pressable>

          {/* Audit 2026-05-22 subtractive: inner quick-start chips
              (16:8 / 18:6 / Custom) removed. They duplicated the wider
              outer preset picker (16:8 / 18:6 / 20:4 / 14:10) visually
              even though their function differed (quick-start vs change
              default). Users couldn't tell which row did which just by
              looking. Net result: single preset row below, plus Start
              Fast button = same flow, one less chip set to scan. */}
        </View>
      ) : (
      <View style={[styles.card, { alignItems: "center" }]}>
        <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
            {(() => {
              const idleTrack = !isFasting || pct < 0.005;
              return (
                <>
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={R}
                    stroke={colors.border}
                    strokeWidth={STROKE}
                    fill="none"
                    opacity={idleTrack ? 0.35 : 1}
                  />
                  <AnimatedCircle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={R}
                    stroke={isComplete ? Accent.success : Accent.primary}
                    strokeWidth={STROKE}
                    fill="none"
                    strokeDasharray={`${CIRC}`}
                    animatedProps={animatedProps}
                    strokeLinecap={pct < 0.02 ? "butt" : "round"}
                    rotation="-90"
                    origin={`${RING_SIZE / 2},${RING_SIZE / 2}`}
                  />
                </>
              );
            })()}
          </Svg>
          {/* Audit 2026-05-04 #32: idle ring centred a flat grey "—"
              that read as an unfinished UI element. Use the canonical
              fasting copy ("Ready") inside the ring when idle so the
              centre always carries meaning; the duration display takes
              over once a fast starts. The full "Ready when you are"
              still lives just below as a subtitle. */}
          <Text style={{ fontSize: isFasting ? 40 : 22, fontWeight: "800", color: isFasting ? colors.text : colors.textTertiary, fontVariant: ["tabular-nums"], letterSpacing: isFasting ? 0 : 0.5 }}>
            {isFasting ? dur.display : "Ready"}
          </Text>
        </View>

        <Text style={[styles.stateLabel, { color: isFasting ? (isComplete ? Accent.success : Accent.primary) : colors.textSecondary }]}>
          {isFasting ? (isComplete ? "Fast complete" : "Fasting") : "Ready when you are"}
        </Text>
        <Text style={styles.windowLabel}>{fastHours}:{eatHours} — {fastHours}h fast, {eatHours}h eat</Text>

        {/* ENG-52 (2026-05-16): stage-of-fasting narrative line below
            the ring. Hedged copy (no absolute claims); pure
            elapsed-time → string via `fastingStageNarrative` so the
            buckets are testable independently of UI. Only renders
            while a fast is active. */}
        {isFasting && !isComplete && (
          <Text style={styles.stageNarrative}>{fastingStageNarrative(elapsed)}</Text>
        )}

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
      )}

      {/* Fasting window picker — 2026-05-02 (Build 40 outstanding
          feedback "Settings search 'fast' → no matches"). Pre-fix the
          window was set in onboarding and never editable in-app on
          mobile, despite the web FastingTimer offering 16:8 / 18:6 /
          20:4 / 14:10 chips since launch. Picker hides while a fast
          is active so we don't silently rebase the goal time
          mid-session — finish or end the current fast first. */}
      {!isFasting && (
        <>
          <View style={styles.presetRow} testID="fasting-window-picker">
            {WINDOW_PRESETS.map((w) => {
              const selected = w === fastingWindow;
              return (
                <Pressable
                  key={w}
                  testID={`fasting-window-preset-${w}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Set fasting window to ${w}`}
                  accessibilityState={{ selected }}
                  onPress={() => changeWindow(w)}
                  style={[
                    styles.presetPill,
                    {
                      // Canonical 2026-05-22: selected segmented controls
                      // use --accent-primary-soft + --accent-primary text,
                      // NOT solid indigo. Solid is reserved for the one
                      // primary action per screen (Start Fast button).
                      backgroundColor: selected
                        ? Accent.primarySoft
                        : colors.card,
                      borderColor: selected
                        ? Accent.primary
                        : colors.border,
                    },
                  ]}
                  hitSlop={6}
                >
                  <Text
                    style={[
                      styles.presetPillText,
                      { color: selected ? Accent.primary : colors.text },
                    ]}
                  >
                    {w}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* Audit 2026-05-22 subtractive: "Tap a preset to change
              your fasting window" instructional caption removed. The
              chip set itself is the affordance; explicit "tap me" copy
              read as iOS 7-era tutorial chrome. */}
        </>
      )}

      {/* Start / End button — 2026-04-30 audit visual-qa P1 #5:
          End Fast was rendered as a full-width destructive red,
          jarring against the rest of the indigo language and
          treating a non-destructive action ("end my fast") as if
          it were "delete my data". Primary blue stays for Start
          Fast (the action we want to celebrate). End Fast demotes
          to a quieter outlined button. Complete Fast keeps the
          success-green solid (it's a celebratory state).

          2026-05-14 premium-bar polish #4: the not-fasting "Start
          Fast" duplicate is now suppressed — the landing card above
          renders its own primary Start Fast CTA. We only render the
          isFasting branch (End Fast / Complete Fast) here. */}
      {isFasting && !isComplete ? (
        // 2026-05-12 (premium-bar audit J1 active timer): End Fast
        // promoted to long-press-to-end so a stray tap on an active
        // fast doesn't kill a 16-hour run. Tap-only fires a haptic
        // warning + Alert nudging the user to long-press; long-press
        // fires a success haptic + ends the fast. Matches Apple Health
        // / Zero's pattern for irreversible-ish controls.
        <Pressable
          style={[
            styles.btn,
            {
              backgroundColor: "transparent",
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="End fast — long-press to confirm"
          accessibilityHint="Long-press for one second to end your fast"
          onPress={() => {
            if (process.env.EXPO_OS === "ios") {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            Alert.alert(
              "Hold to end fast",
              "Long-press the End Fast button to confirm. This stops your active fast and saves the duration to your history.",
            );
          }}
          onLongPress={() => {
            if (process.env.EXPO_OS === "ios") {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            endFast();
          }}
          delayLongPress={650}
        >
          <Text style={[styles.btnText, { color: colors.textSecondary }]}>Hold to End Fast</Text>
        </Pressable>
      ) : isFasting && isComplete ? (
        <Pressable
          style={[
            styles.btn,
            { backgroundColor: Accent.success },
          ]}
          onPress={endFast}
        >
          <Text style={styles.btnText}>Complete Fast</Text>
        </Pressable>
      ) : null}

      {/* History */}
      {recentCompleted.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.historyTitle}>Recent Fasts</Text>
          {/*
            V11/V12 (2026-05-11 visual sweep): the sweep flagged a
            63h 30m completed fast + duplicate same-day entries.
            Neither is a bug per se (long fasts are valid; same-day
            entries are valid when two fasts genuinely happen on one
            day), but the user had no way to clean up bad-data rows
            (e.g. forgot-to-end fasts). Long-press → confirm delete
            gives that affordance. Unusually long fasts (>30h) get a
            subtle "Extended" badge so the user can quickly identify
            them vs forgot-to-end.
          */}
          {recentCompleted.map((s) => {
            const startD = new Date(s.start);
            const endD = new Date(s.end!);
            const durMs = endD.getTime() - startD.getTime();
            const fd = formatDuration(durMs);
            const isExtended = durMs > 30 * 60 * 60 * 1000;
            return (
              <Pressable
                key={s.start}
                accessibilityRole="button"
                accessibilityLabel={`Fast on ${startD.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, duration ${fd.hours} hours ${fd.minutes} minutes. Long-press to delete.`}
                onLongPress={() => {
                  Alert.alert(
                    "Delete this fast?",
                    `${fd.hours}h ${fd.minutes}m on ${startD.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          persist(sessions.filter((x) => x.start !== s.start));
                        },
                      },
                    ],
                  );
                }}
                style={({ pressed }) => ({
                  ...styles.histRow,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={styles.histDate}>
                  {startD.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {isExtended ? (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: Accent.warning + "1F",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: Accent.warning,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        Extended
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.histDuration}>
                    {fd.hours}h {fd.minutes}m
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
