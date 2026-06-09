import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSafeBack } from "@/hooks/use-safe-back";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { useHaptics } from "@/hooks/useHaptics";
import { Flame, Moon } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { Accent, FontFamily, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { fastingStageNarrative } from "@suppr/shared/nutrition/fastingStageNarrative";
import {
  FASTING_WINDOW_PRESETS,
  fastingWindowLabel,
} from "@suppr/shared/fasting/milestones";
import {
  FASTING_STAGES,
  fastingStageAtHours,
  fastingStageBarFraction,
} from "@suppr/shared/fasting/stages";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type FastingSession = { start: string; end: string | null };

// Sloe ring geometry (Figma 305:2) — 248px outer / 14px stroke. Matches
// the web FastingTimer ring so the two surfaces read as one product.
const RING_SIZE = 248;
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

/**
 * Suppr mobile Fasting — SLOE DS migration (2026-06-07, Figma 305:2).
 *
 * Reskins the legacy indigo fasting timer onto the Sloe design system:
 * cream `surface-card` slabs, plum serif heading (via PushScreenHeader),
 * preset pills (plum-filled selected, frost-mist idle) supporting all
 * five windows incl. OMAD (ENG-922), a 248px clay progress ring on a
 * frost-mist track with a flame stage chip + serif elapsed + "elapsed ·
 * X left", a Fasting-stages bar slab, a Started/Goal slab, a clay
 * End-fast pill, and an italic serif stage-narrative quote.
 *
 * All wired functionality is preserved exactly: load/persist, the live
 * timer + animated ring, start/end (long-press End Fast), the in-app
 * window picker, quick-start chips, history with long-press delete +
 * "Extended" badge. Only the skin + the OMAD preset are new.
 *
 * Data contract unchanged — `profiles.fasting_window` +
 * `fasting_sessions`, read + written by web too so a fast started on
 * either client shows live on the other.
 */
export default function FastingScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useSafeBack("/(tabs)");
  const haptics = useHaptics();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the fasting ring
  // (primary/soft/solid), the stage rail, and the end-fast CTA. Threaded into
  // the memoised StyleSheet via the dep array below. The COMPLETE ring keeps
  // `Accent.success` (sage); the eating-window caution keeps warning/warningSolid.
  const accent = useAccent();

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
  const elapsedHours = elapsed / 3600_000;
  const pct = activeFast ? Math.min(1, elapsed / fastMs) : 0;
  const isFasting = !!activeFast;
  const isComplete = pct >= 1;
  const remaining = Math.max(0, fastMs - elapsed);

  // Current fasting stage + bar fraction (Sloe stages bar, 305:2).
  const { index: stageIndex } = useMemo(
    () => fastingStageAtHours(elapsedHours),
    [elapsedHours],
  );
  const stageBarFraction = useMemo(
    () => fastingStageBarFraction(elapsedHours, fastHours),
    [elapsedHours, fastHours],
  );

  useEffect(() => {
    if (!userId) return;
    // Debug audit 2026-05-04 (code-quality #7): cancellation flag +
    // try/finally so loading always resolves and stale rows can't win.
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
   * `profiles.fasting_window` and updates local state so the ring + ETA
   * + Goal timestamp re-render against the new fast length immediately.
   * Mirrors the web FastingTimer's `changeWindow` — both platforms
   * accept the same preset strings so the stored value round-trips.
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
   * Quick-start the user's fast with a specific preset in one tap. Sets
   * the fasting window (persists) and immediately starts a fast. Used by
   * the landing-card chips (16:8 / 18:6 / OMAD) to remove the two-step
   * "pick window then tap Start" hop for the common journey.
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
  const remainingDur = formatDuration(remaining);

  const ringColor = isComplete ? Accent.success : accent.primary;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Outer screen shell. `PushScreenHeader` self-insets for the
        // status bar, so the shell + ScrollView must NOT re-apply
        // `insets.top` — doing so stacked the safe-area inset twice and
        // pushed the header ~a third of the way down (the void Grace saw).
        screen: { flex: 1, backgroundColor: colors.background },
        container: { flex: 1, backgroundColor: colors.background },
        // Cream surface-card slab — Sloe 305:2 geometry (r16 / hairline).
        card: {
          marginHorizontal: Spacing.lg,
          backgroundColor: colors.card,
          borderRadius: Radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
          marginBottom: Spacing.lg,
        },
        // Ring centre stage chip — clay flame on a clay tint.
        stageChip: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          backgroundColor: accent.primarySoft,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: Radius.full,
          marginBottom: Spacing.sm,
        },
        stageChipText: {
          ...Type.label,
          color: accent.primarySolid,
        },
        ringValue: {
          ...Type.ringValue,
          color: colors.text,
          fontVariant: ["tabular-nums"],
        },
        ringSub: {
          fontFamily: FontFamily.sansRegular,
          fontSize: 13,
          color: colors.textTertiary,
          marginTop: 4,
          fontVariant: ["tabular-nums"],
        },
        // Stage narrative — italic serif quote (305:2).
        stageNarrative: {
          fontFamily: FontFamily.serifItalic,
          fontStyle: "italic",
          fontSize: 16,
          color: colors.text,
          textAlign: "center",
          marginHorizontal: Spacing.xl,
          marginBottom: Spacing.lg,
          lineHeight: 22,
        },
        sectionLabel: {
          ...Type.label,
          color: colors.textTertiary,
          marginBottom: Spacing.md,
        },
        // Preset pills — frost-mist idle, plum-filled selected. Small top
        // gap separates the row from the header; bottom margin steps down
        // to the idle slab without double-stacking the card's own margin.
        presetRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginHorizontal: Spacing.lg,
          marginTop: Spacing.xs,
          marginBottom: Spacing.md,
          justifyContent: "center",
        },
        presetPill: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: Radius.full,
          borderWidth: 1,
        },
        presetPillText: {
          fontFamily: FontFamily.sansSemibold,
          fontSize: 13,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
        },
        // Started / Goal slab.
        startGoalRow: { flexDirection: "row" },
        startGoalCol: { flex: 1, alignItems: "center" },
        startGoalDivider: { width: 1, backgroundColor: colors.border },
        startGoalLabel: { ...Type.label, color: colors.textTertiary, fontSize: 10, letterSpacing: 0.6 },
        startGoalValue: {
          fontFamily: FontFamily.serifSemibold,
          fontSize: 18,
          color: colors.text,
          marginTop: 4,
          fontVariant: ["tabular-nums"],
        },
        // End-fast pill — clay, full-width, rounded-full.
        endBtn: {
          marginHorizontal: Spacing.lg,
          paddingVertical: 16,
          borderRadius: Radius.full,
          alignItems: "center",
          marginBottom: Spacing.lg,
        },
        endBtnText: { fontFamily: FontFamily.sansSemibold, fontSize: 16, fontWeight: "600" },
        // Landing card.
        landingGlyph: {
          width: 96,
          height: 96,
          borderRadius: 48,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.ringTrack,
          marginBottom: Spacing.lg,
        },
        landingTitle: {
          fontFamily: FontFamily.serifMedium,
          fontSize: 24,
          color: colors.navPrimary,
          textAlign: "center",
          marginBottom: Spacing.sm,
        },
        landingBody: {
          fontFamily: FontFamily.sansRegular,
          fontSize: 14,
          color: colors.textSecondary,
          textAlign: "center",
          lineHeight: 20,
          marginBottom: Spacing.md,
          paddingHorizontal: Spacing.sm,
        },
        landingWindow: {
          fontFamily: FontFamily.sansRegular,
          fontSize: 12,
          color: colors.textTertiary,
          textAlign: "center",
          marginBottom: Spacing.lg,
          fontVariant: ["tabular-nums"],
        },
        landingChipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginTop: Spacing.md,
          justifyContent: "center",
        },
        landingChip: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        landingChipText: {
          fontFamily: FontFamily.sansSemibold,
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          fontVariant: ["tabular-nums"],
        },
        historyTitle: { ...Type.label, color: colors.textTertiary, marginBottom: Spacing.sm },
        histRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
        histDate: { fontFamily: FontFamily.sansRegular, fontSize: 13, color: colors.textSecondary },
        histDuration: { fontFamily: FontFamily.sansSemibold, fontSize: 13, fontWeight: "600", color: colors.text },
      }),
    [colors, accent],
  );

  if (loading) return <View style={[styles.screen, { paddingTop: insets.top }]} />;

  return (
    <View testID="screen-fasting" style={styles.screen}>
      {/* Header self-insets for the status bar — siblings (macro-detail,
          burn-detail) place it outside the ScrollView with no extra
          top padding. The ScrollView must not re-add `insets.top`. */}
      <PushScreenHeader title="Fasting" onBack={goBack} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Preset pills — frost-mist idle, plum-filled selected. Hidden
          while a fast is active so we don't silently rebase the goal
          mid-session. All five windows incl. OMAD (ENG-922). */}
      {!isFasting && (
        <View style={styles.presetRow} testID="fasting-window-picker">
          {FASTING_WINDOW_PRESETS.map((w) => {
            const selected = w === fastingWindow;
            return (
              <Pressable
                key={w}
                testID={`fasting-window-preset-${w}`}
                accessibilityRole="button"
                accessibilityLabel={`Set fasting window to ${fastingWindowLabel(w)}`}
                accessibilityState={{ selected }}
                onPress={() => changeWindow(w)}
                style={[
                  styles.presetPill,
                  // Sloe treatment system (§7): selected preset = aubergine
                  // soft-tint fill + primarySolid border/label (was a solid
                  // plum fill). Idle stays cream + hairline.
                  {
                    backgroundColor: selected ? accent.primarySoft : colors.card,
                    borderColor: selected ? accent.primarySolid : colors.border,
                  },
                ]}
                hitSlop={6}
              >
                <Text
                  style={[
                    styles.presetPillText,
                    { color: selected ? accent.primarySolid : colors.text },
                  ]}
                >
                  {fastingWindowLabel(w)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {!isFasting ? (
        <View style={[styles.card, { alignItems: "center" }]} testID="fasting-landing">
          <View style={styles.landingGlyph}>
            <Moon size={48} color={colors.navPrimary} strokeWidth={1.5} />
          </View>
          <Text style={styles.landingTitle}>Fast when you&apos;re ready</Text>
          <Text style={styles.landingBody}>
            A fasting window is just a way to structure when you eat. Start
            one whenever you like.
          </Text>
          {/* Ready-when-you-are sub-label retained so the existing Maestro
              13_fasting flow regex
              (Ready when you are|FASTING|FAST COMPLETE) keeps matching the
              not-fasting state. */}
          <Text
            style={{
              fontFamily: FontFamily.sansSemibold,
              fontSize: 14,
              fontWeight: "600",
              color: colors.textSecondary,
              textAlign: "center",
            }}
          >
            Ready when you are
          </Text>
          <Text style={styles.landingWindow}>
            {fastingWindowLabel(fastingWindow)} — {fastHours}h fast, {eatHours}h eat
          </Text>

          <Pressable
            testID="fasting-landing-start"
            accessibilityRole="button"
            accessibilityLabel={`Start a ${fastingWindowLabel(fastingWindow)} fast`}
            onPress={startFast}
            style={{
              marginTop: Spacing.sm,
              paddingVertical: 14,
              paddingHorizontal: 28,
              borderRadius: Radius.full,
              // Sloe treatment system (§1): primary inline CTA = aubergine
              // OUTLINE (transparent fill, 1.5px primarySolid border + label).
              backgroundColor: "transparent",
              borderWidth: 1.5,
              borderColor: accent.primarySolid,
              alignItems: "center",
              alignSelf: "stretch",
            }}
          >
            <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 16, fontWeight: "600", color: accent.primarySolid }}>
              Start fast
            </Text>
          </Pressable>

          {/* One-tap quick-start chips — set window + start (16:8 / 18:6 /
              OMAD). Web-parity with the FastingTimer landing chips. */}
          <View style={styles.landingChipRow} testID="fasting-landing-chips">
            {(["16:8", "18:6", "23:1"] as const).map((w) => (
              <Pressable
                key={w}
                testID={`fasting-landing-chip-${fastingWindowLabel(w)}`}
                accessibilityRole="button"
                accessibilityLabel={`Start a ${fastingWindowLabel(w)} fast`}
                onPress={() => quickStartFast(w)}
                style={styles.landingChip}
                hitSlop={6}
              >
                <Text style={styles.landingChipText}>{fastingWindowLabel(w)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.card, { alignItems: "center" }]}>
          <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
            <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={R}
                stroke={colors.ringTrack}
                strokeWidth={STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={R}
                stroke={ringColor}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${CIRC}`}
                animatedProps={animatedProps}
                strokeLinecap={pct < 0.02 ? "butt" : "round"}
                rotation="-90"
                origin={`${RING_SIZE / 2},${RING_SIZE / 2}`}
              />
            </Svg>
            {/* Current-stage chip — clay flame, descriptive body state. */}
            <View style={styles.stageChip}>
              <Flame size={14} color={accent.primarySolid} strokeWidth={2} />
              <Text style={styles.stageChipText}>{FASTING_STAGES[stageIndex].label}</Text>
            </View>
            <Text style={styles.ringValue}>{dur.hours}:{String(dur.minutes).padStart(2, "0")}</Text>
            <Text style={styles.ringSub}>
              {isComplete
                ? "elapsed · goal reached"
                : `elapsed · ${remainingDur.hours}:${String(remainingDur.minutes).padStart(2, "0")} left`}
            </Text>
          </View>
        </View>
      )}

      {/* Fasting stages bar — Fed → Fat burning → Ketosis → Deep. */}
      {isFasting && (
        <View style={styles.card} testID="fasting-stages">
          <Text style={styles.sectionLabel}>FASTING STAGES</Text>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, marginBottom: 4 }}>
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: 6,
                borderRadius: 3,
                backgroundColor: accent.primary,
                width: `${stageBarFraction * 100}%`,
              }}
            />
            {FASTING_STAGES.map((stage, i) => {
              const pos = (i / (FASTING_STAGES.length - 1)) * 100;
              const reached = i <= stageIndex;
              return (
                <View
                  key={stage.id}
                  style={{
                    position: "absolute",
                    top: -2,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    borderWidth: 2,
                    borderColor: colors.card,
                    backgroundColor: reached ? accent.primary : colors.border,
                    left: `${pos}%`,
                    marginLeft: -5,
                  }}
                />
              );
            })}
            <View
              style={{
                position: "absolute",
                top: -5,
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: colors.card,
                backgroundColor: accent.primary,
                left: `${stageBarFraction * 100}%`,
                marginLeft: -8,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm }}>
            {FASTING_STAGES.map((stage, i) => (
              <Text
                key={stage.id}
                style={{
                  fontFamily: FontFamily.sansSemibold,
                  fontSize: 10,
                  color: i === stageIndex ? accent.primarySolid : colors.textTertiary,
                  fontWeight: i === stageIndex ? "600" : "400",
                }}
              >
                {stage.label}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Started / Goal slab. */}
      {isFasting && (
        <View style={styles.card}>
          <View style={styles.startGoalRow}>
            <View style={styles.startGoalCol}>
              <Text style={styles.startGoalLabel}>STARTED</Text>
              <Text style={styles.startGoalValue}>
                {new Date(activeFast!.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
            <View style={styles.startGoalDivider} />
            <View style={styles.startGoalCol}>
              <Text style={styles.startGoalLabel}>GOAL</Text>
              <Text style={styles.startGoalValue}>
                {new Date(new Date(activeFast!.start).getTime() + fastMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* End / Complete fast — clay pill (Complete keeps sage when goal
          met). End Fast stays long-press-to-confirm so a stray tap on an
          active 16h+ fast doesn't kill it (web uses single-tap; pointer
          precision makes a stray hit unlikely there). */}
      {isFasting && !isComplete ? (
        <Pressable
          style={[
            styles.endBtn,
            // Sloe treatment system (§1): End-fast is a primary inline CTA →
            // aubergine OUTLINE, not a filled slab (ending a fast is a normal
            // completion, not a destructive-red action).
            { backgroundColor: "transparent", borderWidth: 1.5, borderColor: accent.primarySolid },
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
              "Long-press the End fast button to confirm. This stops your active fast and saves the duration to your history.",
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
          <Text style={[styles.endBtnText, { color: accent.primarySolid }]}>Hold to end fast</Text>
        </Pressable>
      ) : isFasting && isComplete ? (
        <Pressable
          style={[styles.endBtn, { backgroundColor: Accent.success }]}
          onPress={endFast}
        >
          <Text style={[styles.endBtnText, { color: "#FFFFFF" }]}>Complete fast</Text>
        </Pressable>
      ) : null}

      {/* Stage narrative — italic serif quote. Hedged, descriptive. */}
      {isFasting && !isComplete && (
        <Text style={styles.stageNarrative}>{fastingStageNarrative(elapsed)}</Text>
      )}

      {/* History */}
      {recentCompleted.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.historyTitle}>RECENT FASTS</Text>
          {/*
            V11/V12 (2026-05-11 visual sweep): long-press → confirm delete
            for forgot-to-end cleanup. Unusually long fasts (>30h) get a
            subtle "Extended" badge so the user can identify them quickly.
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
                          fontFamily: FontFamily.sansSemibold,
                          fontSize: 10,
                          fontWeight: "600",
                          color: Accent.warningSolid,
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
    </View>
  );
}
