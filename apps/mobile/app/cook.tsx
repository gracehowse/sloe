import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { supabase } from "@/lib/supabase";
import { Neon, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTimerFromStep(text: string): number | null {
  const patterns = [
    /(\d+)\s*[–-]\s*(\d+)\s*min/i,
    /(\d+)\s*min/i,
    /(\d+)\s*hour/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    if (p.source.includes("hour")) return parseInt(m[1]!) * 3600;
    const val = m[2] ? parseInt(m[2]!) : parseInt(m[1]!);
    return val * 60;
  }
  return null;
}

export default function CookModeScreen() {
  useKeepAwake();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { recipeId, title, steps: stepsJson } = useLocalSearchParams<{
    recipeId: string;
    title: string;
    steps: string;
  }>();

  const steps: string[] = stepsJson ? JSON.parse(stepsJson) : [];
  const [current, setCurrent] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSteps = steps.length;
  const isDone = current >= totalSteps;
  const stepText = current < totalSteps ? steps[current]!.replace(/^\d+[\.\)\-]\s*/, "") : "";
  const stepTimer = current < totalSteps ? parseTimerFromStep(steps[current]!) : null;

  // Timer countdown
  useEffect(() => {
    if (timerActive && timerRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            Alert.alert("Timer done!");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerActive, timerRemaining]);

  const goNext = () => {
    setTimerActive(false);
    setTimerRemaining(0);
    if (current < totalSteps) setCurrent((c) => c + 1);
  };

  const goPrev = () => {
    setTimerActive(false);
    setTimerRemaining(0);
    if (current > 0) setCurrent((c) => c - 1);
  };

  const startTimer = () => {
    if (stepTimer) {
      setTimerRemaining(stepTimer);
      setTimerActive(true);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md, padding: Spacing.xxl },
    errorText: { color: colors.text, fontSize: 16 },
    backBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border },
    backBtnText: { color: colors.text, fontWeight: "600" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBack: { color: colors.textSecondary, fontSize: 20, fontWeight: "600" },
    headerTitle: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1, textAlign: "center" },

    stepContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.xl,
    },

    stepBadge: {
      backgroundColor: Neon.purple + "20",
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
    },
    stepBadgeText: { color: Neon.purple, fontSize: 13, fontWeight: "700" },

    progressRow: {
      flexDirection: "row",
      gap: 4,
      width: "100%",
    },
    progressDot: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
    },
    progressDotDone: { backgroundColor: Neon.purple },
    progressDotActive: { backgroundColor: Neon.pink },

    stepText: {
      fontSize: 24,
      fontWeight: "500",
      color: colors.text,
      textAlign: "center",
      lineHeight: 34,
    },

    timerSection: { marginTop: Spacing.md },
    timerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.lg },
    timerDisplay: {
      fontSize: 40,
      fontWeight: "700",
      color: Neon.purple,
      fontVariant: ["tabular-nums"],
      fontFamily: "Menlo",
    },
    timerCancelBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timerCancelText: { color: colors.textSecondary, fontWeight: "600" },
    timerStartBtn: {
      backgroundColor: Neon.purple + "20",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
    },
    timerStartText: { color: Neon.purple, fontWeight: "600", fontSize: 15 },

    navRow: {
      flexDirection: "row",
      gap: Spacing.md,
      width: "100%",
      marginTop: Spacing.xl,
    },
    navBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    navBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 16 },
    nextBtn: {
      flex: 2,
      paddingVertical: 16,
      borderRadius: Radius.md,
      backgroundColor: Neon.purple,
      alignItems: "center",
    },
    nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    doneIcon: { fontSize: 48 },
    doneTitle: { fontSize: 24, fontWeight: "700", color: colors.text },
    doneSubtext: { fontSize: 14, color: colors.textSecondary },
    doneBtn: {
      marginTop: Spacing.lg,
      backgroundColor: Neon.purple,
      paddingHorizontal: Spacing.xxxl,
      paddingVertical: 14,
      borderRadius: Radius.md,
    },
    doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  }), [colors]);

  if (steps.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No instructions available</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerBack}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{title ?? "Cook Mode"}</Text>
        <View style={{ width: 28 }} />
      </View>

      {!isDone ? (
        <View style={styles.stepContainer}>
          {/* Step counter */}
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>Step {current + 1} of {totalSteps}</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i < current && styles.progressDotDone,
                  i === current && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {/* Step text */}
          <Text style={styles.stepText}>{stepText}</Text>

          {/* Timer */}
          {stepTimer && (
            <View style={styles.timerSection}>
              {timerActive ? (
                <View style={styles.timerRow}>
                  <Text style={styles.timerDisplay}>{formatTimer(timerRemaining)}</Text>
                  <Pressable style={styles.timerCancelBtn} onPress={() => setTimerActive(false)}>
                    <Text style={styles.timerCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : timerRemaining === 0 ? (
                <Pressable style={styles.timerStartBtn} onPress={startTimer}>
                  <Text style={styles.timerStartText}>⏱ Start {formatTimer(stepTimer)} timer</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Navigation */}
          <View style={styles.navRow}>
            <Pressable
              style={[styles.navBtn, current === 0 && { opacity: 0.3 }]}
              onPress={goPrev}
              disabled={current === 0}
            >
              <Text style={styles.navBtnText}>‹ Back</Text>
            </Pressable>
            <Pressable style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>
                {current === totalSteps - 1 ? "Finish" : "Next ›"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Done state */
        <View style={styles.centered}>
          <Text style={styles.doneIcon}>🎉</Text>
          <Text style={styles.doneTitle}>Enjoy your meal!</Text>
          <Text style={styles.doneSubtext}>{title}</Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
