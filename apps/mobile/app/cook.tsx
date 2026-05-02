import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { Mic, MicOff } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import {
  COOK_HANDSFREE_FEATURE_ENABLED,
  ageGateTooltip,
  readHandsfreeConsent,
  readHandsfreeEnabled,
  readHandsfreeHintSeen,
  resolveHandsfreeAgeGate,
  writeHandsfreeEnabled,
  writeHandsfreeHintSeen,
  type AgeGateResult,
  type HandsfreeCommand,
} from "@/lib/cookHandsfree";
import {
  isOnDeviceRecognitionSupported,
  startCookHandsfreeListener,
  type HandsfreeListener,
} from "@/lib/cookHandsfreeListener";
import CookHandsfreeConsentSheet from "@/components/cook/CookHandsfreeConsentSheet";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** Soft-cap: number of consecutive misses before we surface the
 *  de-escalation strip. A "miss" is an unmatched final transcript
 *  followed by a manual nav-button tap within MISS_TAP_WINDOW_MS. */
const HANDSFREE_MISS_THRESHOLD = 3;

/** Window after an unmatched transcript during which a manual tap on
 *  a nav button is treated as evidence the listener missed the user.
 *  4 seconds matches the legal-review spec section 7. */
const MISS_TAP_WINDOW_MS = 4000;

/** How long the "Heard: <command>" transcript chip stays on screen
 *  after a successful match. 220ms per design spec. */
const TRANSCRIPT_CHIP_DURATION_MS = 220;

/** How long the mic icon flashes to "detected" tint when a command
 *  is recognised. 180ms per design spec. */
const DETECTED_FLASH_DURATION_MS = 180;

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Mic-toggle visual state. Distinct from the boolean toggle value
 *  because the listener has additional sub-states (listening vs.
 *  detected vs. error) the UI needs to reflect. */
type MicVisualState = "off" | "listening" | "detected" | "error";

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

  // CM1 fix (2026-04-28): a malformed `steps` query param used to crash
  // the screen with no error UI — `JSON.parse` would throw on the
  // synchronous render path and Expo Router would surface a red box in
  // dev / a blank screen in prod. Now we fail safe to an empty array
  // and the screen renders the "no instructions yet" state below.
  const steps: string[] = (() => {
    if (!stepsJson) return [];
    try {
      const parsed = JSON.parse(stepsJson);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((s): s is string => typeof s === "string");
    } catch {
      return [];
    }
  })();
  const [current, setCurrent] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressWidthRef = useRef(new Animated.Value(0)).current;

  // -- Handsfree state (v1 + v2 share the same persisted opt-in pref) --
  /** Master toggle (mirrors `suppr.cook.handsfree.enabled` AsyncStorage
   *  key). Defaults to OFF until hydrated; user-flipped values write
   *  back to storage so the Settings switch and the in-cook surface
   *  stay in sync. */
  const [handsfreeOn, setHandsfreeOn] = useState(false);

  /** Mic icon visual state — only meaningful when `handsfreeOn` is
   *  true. v1 stays at "off" (no listener) so the icon paints in the
   *  primary tint with no pulse. v2 transitions through listening /
   *  detected / error as the recogniser runs. */
  const [micVisual, setMicVisual] = useState<MicVisualState>("off");

  /** Age-gate result resolved from the user's `profiles.age` field.
   *  Defaults to `blocked_unknown` so the toggle stays disabled until
   *  the profile load resolves — privacy-safe failure mode. */
  const [ageGate, setAgeGate] = useState<AgeGateResult>("blocked_unknown");

  /** On-device recognition support, resolved on mount. Undefined ==
   *  "not yet checked", false == "device unsupported, disable
   *  toggle", true == "OK, can proceed". v1 ignores this (no
   *  listener); v2 reads it before allowing the consent sheet to
   *  open. */
  const [onDeviceSupported, setOnDeviceSupported] = useState<boolean | null>(
    null,
  );

  /** Whether the pre-permission explainer sheet has been shown +
   *  acknowledged for this device. Drives the flow on first toggle-
   *  ON: false → show sheet → wait for OS permission → start
   *  listener; true → skip straight to listener (or to OS Settings
   *  hint if iOS perm was denied). */
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentSheetVisible, setConsentSheetVisible] = useState(false);

  /** Listening hint banner — one-shot per device. Defaults to
   *  showing; once dismissed, persists `hint_seen=1` and stays
   *  hidden. */
  const [hintVisible, setHintVisible] = useState(true);

  /** Last "Heard: <command>" transcript chip — drives the 220ms
   *  feedback after a match. Cleared by a timeout. */
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const transcriptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Soft-cap miss tracking. `lastMissAt` is the timestamp of the
   *  most recent unmatched final transcript; if the user taps a nav
   *  button within `MISS_TAP_WINDOW_MS` of that, we count it as a
   *  miss. After three consecutive misses the de-escalation strip
   *  appears. */
  const lastMissAtRef = useRef<number | null>(null);
  const [missCount, setMissCount] = useState(0);
  const [deescalationVisible, setDeescalationVisible] = useState(false);

  /** Mic icon pulse animation (1.0 → 1.08, 1.6s ease-in-out, loops
   *  while listening). */
  const pulseRef = useRef(new Animated.Value(1)).current;

  /** Listener handle. Held in a ref so the cleanup effect can stop
   *  it without depending on render state. */
  const listenerRef = useRef<HandsfreeListener | null>(null);

  /** Holds the timestamp of the last final-result event so we can
   *  compute latencyMs in the analytics payload. */
  const lastResultStartRef = useRef<number | null>(null);

  const totalSteps = steps.length;
  const isDone = current >= totalSteps;
  const stepText = current < totalSteps ? steps[current]!.replace(/^\d+[\.\)\-]\s*/, "") : "";

  // Track cook mode open — parity with web `CookMode.tsx` (audit R2,
  // 2026-04-18). Same event name + `{ recipeId, stepCount }` payload shape
  // as the web call site (`recipe.id` there, `recipeId` from query params
  // here). Fires once per mount. Mobile previously silent on this event.
  useEffect(() => {
    track(AnalyticsEvents.cook_mode_opened, {
      recipeId,
      stepCount: totalSteps,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate persisted state once on mount. Storage failures fall back
  // to OFF / no-consent — privacy-safe defaults. Also hydrates the
  // age gate from `profiles.age` so the toggle reaches its final
  // disabled-or-not state without an extra render.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [enabled, consent, hintSeen] = await Promise.all([
        readHandsfreeEnabled(),
        readHandsfreeConsent(),
        readHandsfreeHintSeen(),
      ]);
      if (cancelled) return;
      setHandsfreeOn(enabled);
      setConsentGiven(consent);
      setHintVisible(!hintSeen);

      // On-device-recognition capability — synchronous, no await.
      // Wrapped in try so a misconfigured device never throws out of
      // the effect.
      try {
        setOnDeviceSupported(isOnDeviceRecognitionSupported());
      } catch {
        setOnDeviceSupported(false);
      }

      // Age gate: read `profiles.age` from Supabase. The cook screen
      // doesn't otherwise consume the profile, so we do a single
      // targeted read here rather than wiring a context.
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setAgeGate("blocked_unknown");
          return;
        }
        const { data } = await supabase
          .from("profiles")
          .select("age")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        const ageValue = data?.age;
        const age = typeof ageValue === "number" ? ageValue : null;
        setAgeGate(resolveHandsfreeAgeGate(age));
      } catch {
        if (!cancelled) setAgeGate("blocked_unknown");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pulse the mic icon while listening. Loops indefinitely; stops
  // when the visual state leaves "listening".
  useEffect(() => {
    if (micVisual !== "listening") {
      pulseRef.stopAnimation();
      pulseRef.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRef, {
          toValue: 1.08,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRef, {
          toValue: 1.0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [micVisual, pulseRef]);

  // -- Listener lifecycle (v2 only) ---------------------------------
  /** Start the listener. Called when the toggle flips ON, the consent
   *  sheet has been acknowledged, and the iOS permission has been
   *  granted. Idempotent — bails if a listener is already active. */
  const beginListening = useCallback(() => {
    if (listenerRef.current) return;
    if (!COOK_HANDSFREE_FEATURE_ENABLED) return;

    setMicVisual("listening");
    const listener = startCookHandsfreeListener({
      onStart: () => {
        setMicVisual("listening");
      },
      onCommand: (command, transcript) => {
        const startedAt = lastResultStartRef.current;
        const latencyMs =
          startedAt != null ? Math.max(0, Date.now() - startedAt) : 0;
        lastResultStartRef.current = Date.now();
        track(AnalyticsEvents.cook_handsfree_command_detected, {
          recipeId,
          command,
          latencyMs,
        });

        // 180ms detected flash on the mic icon, then back to listening.
        setMicVisual("detected");
        setTimeout(() => setMicVisual("listening"), DETECTED_FLASH_DURATION_MS);

        // 220ms transcript chip — show "Heard: <verb>" so the user
        // sees their command was understood even if the action takes
        // a frame to render.
        if (transcriptTimerRef.current) {
          clearTimeout(transcriptTimerRef.current);
        }
        setLastTranscript(transcript);
        transcriptTimerRef.current = setTimeout(() => {
          setLastTranscript(null);
        }, TRANSCRIPT_CHIP_DURATION_MS + 600);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          /* haptics best-effort */
        });

        applyHandsfreeCommand(command);
      },
      onMiss: () => {
        // Stash the miss timestamp; if a manual tap follows within
        // MISS_TAP_WINDOW_MS we'll bump the miss counter.
        lastMissAtRef.current = Date.now();
      },
      onError: () => {
        setMicVisual("error");
      },
    });

    if (listener) {
      listenerRef.current = listener;
    } else {
      // Listener failed to start — most commonly because the device
      // doesn't expose on-device recognition. Revert to OFF.
      setMicVisual("error");
      setHandsfreeOn(false);
      void writeHandsfreeEnabled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  /** Stop the listener. Safe to call multiple times. The 200ms-stop
   *  contract is met by `module.stop()` being synchronous — we call
   *  it on the same tick as the user action. */
  const stopListening = useCallback(() => {
    listenerRef.current?.stop();
    listenerRef.current = null;
    setMicVisual("off");
  }, []);

  // Always tear down the listener on unmount or screen blur. The
  // privacy claim depends on this — if the listener leaks past the
  // cook screen we're recording audio outside the cook surface.
  useEffect(() => {
    return () => {
      stopListening();
      if (transcriptTimerRef.current) {
        clearTimeout(transcriptTimerRef.current);
      }
    };
  }, [stopListening]);

  useFocusEffect(
    useCallback(() => {
      // No-op on focus. Cleanup runs on blur — stops the listener
      // when the user navigates away mid-cook.
      return () => {
        stopListening();
      };
    }, [stopListening]),
  );

  // Stop the listener when the recipe is done — honours the legal
  // contract that the listener is only live during active cooking.
  useEffect(() => {
    if (isDone) stopListening();
  }, [isDone, stopListening]);

  // Timer count up
  useEffect(() => {
    if (timerActive) {
      intervalRef.current = setInterval(() => {
        setTimerElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerActive]);

  // Animate progress bar
  useEffect(() => {
    const progressPercent = (current + 1) / totalSteps;
    Animated.timing(progressWidthRef, {
      toValue: progressPercent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [current, totalSteps, progressWidthRef]);

  const goNext = useCallback(() => {
    stopTimer();
    if (current < totalSteps) setCurrent((c) => c + 1);
  }, [current, totalSteps]);

  const goPrev = useCallback(() => {
    stopTimer();
    if (current > 0) setCurrent((c) => c - 1);
  }, [current]);

  const startTimer = () => {
    setTimerElapsed(0);
    setTimerActive(true);
    // Parity with web `CookMode.tsx` (audit R2, 2026-04-18). Web fires
    // `{ recipeId, seconds: totalSeconds }` because web timers are
    // pre-parsed countdowns with a known duration. Mobile is a count-up
    // stopwatch with no intended duration at start time, so `seconds`
    // is intentionally omitted — emitting a fake value would poison
    // the dashboard. `recipe_timer_completed` is not fired on mobile
    // because the mobile timer has no natural completion event (the
    // user always presses Stop). Documented in the verification report.
    track(AnalyticsEvents.recipe_timer_started, { recipeId });
  };

  const stopTimer = () => {
    setTimerActive(false);
    setTimerElapsed(0);
  };

  /** Apply a recognised command. Wired to the same nav/timer
   *  primitives the manual buttons use so v2 behaviour matches
   *  v1-with-tapping-buttons exactly. */
  const applyHandsfreeCommand = useCallback(
    (command: HandsfreeCommand) => {
      switch (command) {
        case "next":
          goNext();
          break;
        case "previous":
          goPrev();
          break;
        case "repeat":
          // Speak the current step text. Wrapped in a require so the
          // module is only loaded when the listener actually fires —
          // saves bundle eval on flag-off.
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const Speech = require("expo-speech") as {
              speak: (text: string, opts?: { language?: string }) => void;
            };
            Speech.speak(stepText, { language: "en-US" });
          } catch {
            /* TTS best-effort — fail quietly */
          }
          break;
        case "pause":
          if (timerActive) setTimerActive(false);
          break;
        case "resume":
          if (!timerActive && timerElapsed > 0) setTimerActive(true);
          break;
      }
    },
    [goNext, goPrev, stepText, timerActive, timerElapsed],
  );

  /** Account a manual nav-button tap against the soft-cap miss
   *  counter. Called from the wrapped onPress handlers below. */
  const accountManualTap = useCallback(() => {
    if (!COOK_HANDSFREE_FEATURE_ENABLED) return;
    if (!handsfreeOn) return;
    const lastMiss = lastMissAtRef.current;
    if (lastMiss == null) return;
    const elapsed = Date.now() - lastMiss;
    if (elapsed > MISS_TAP_WINDOW_MS) return;
    lastMissAtRef.current = null;
    setMissCount((prev) => {
      const next = prev + 1;
      if (next >= HANDSFREE_MISS_THRESHOLD) {
        setDeescalationVisible(true);
      }
      return next;
    });
  }, [handsfreeOn]);

  // -- Toggle handler -------------------------------------------------
  const ageGateMessage = ageGateTooltip(ageGate);
  const ageGateBlocked = ageGate !== "allowed";
  const deviceUnsupported =
    COOK_HANDSFREE_FEATURE_ENABLED && onDeviceSupported === false;
  const toggleDisabled =
    COOK_HANDSFREE_FEATURE_ENABLED && (ageGateBlocked || deviceUnsupported);
  const toggleTooltip = ageGateBlocked
    ? ageGateMessage
    : deviceUnsupported
      ? "Voice control isn't supported on this device."
      : null;

  const handleHandsfreeToggle = useCallback(() => {
    // v1 path — flip the boolean, persist, fire analytics. No listener.
    if (!COOK_HANDSFREE_FEATURE_ENABLED) {
      const next = !handsfreeOn;
      setHandsfreeOn(next);
      void writeHandsfreeEnabled(next);
      track(AnalyticsEvents.cook_handsfree_session_toggled, {
        recipeId,
        enabled: next,
      });
      track(AnalyticsEvents.cook_handsfree_pref_changed, { enabled: next });
      return;
    }

    // v2 path — gates: age, device support, consent.
    if (toggleDisabled) return;

    const next = !handsfreeOn;
    track(AnalyticsEvents.cook_handsfree_session_toggled, {
      recipeId,
      enabled: next,
    });
    track(AnalyticsEvents.cook_handsfree_pref_changed, { enabled: next });

    if (!next) {
      // Toggling OFF — stop listener, persist, done.
      setHandsfreeOn(false);
      void writeHandsfreeEnabled(false);
      stopListening();
      return;
    }

    // Toggling ON — first-time users see the explainer; returning
    // users skip straight to the listener.
    if (!consentGiven) {
      setConsentSheetVisible(true);
      return;
    }
    setHandsfreeOn(true);
    void writeHandsfreeEnabled(true);
    beginListening();
  }, [
    beginListening,
    consentGiven,
    handsfreeOn,
    recipeId,
    stopListening,
    toggleDisabled,
  ]);

  /** Resolve the consent-sheet outcome: granted → start listener;
   *  denied → revert toggle state. */
  const handleConsentResolved = useCallback(
    (granted: boolean) => {
      setConsentSheetVisible(false);
      setConsentGiven(true);
      if (!granted) {
        setHandsfreeOn(false);
        void writeHandsfreeEnabled(false);
        return;
      }
      setHandsfreeOn(true);
      void writeHandsfreeEnabled(true);
      beginListening();
    },
    [beginListening],
  );

  const handleConsentDismissed = useCallback(() => {
    setConsentSheetVisible(false);
    // Toggle was optimistically OFF before the sheet — keep it OFF.
    setHandsfreeOn(false);
    void writeHandsfreeEnabled(false);
  }, []);

  // Wrapped nav handlers that account for the soft-cap miss counter.
  const onPressNext = useCallback(() => {
    accountManualTap();
    goNext();
  }, [accountManualTap, goNext]);
  const onPressPrev = useCallback(() => {
    accountManualTap();
    goPrev();
  }, [accountManualTap, goPrev]);

  const handleDeescalationKeep = useCallback(() => {
    setDeescalationVisible(false);
    setMissCount(0);
    track(AnalyticsEvents.cook_handsfree_miss_threshold_hit, {
      recipeId,
      missCount: HANDSFREE_MISS_THRESHOLD,
      action: "kept",
    });
  }, [recipeId]);

  const handleDeescalationTurnOff = useCallback(() => {
    setDeescalationVisible(false);
    setMissCount(0);
    setHandsfreeOn(false);
    void writeHandsfreeEnabled(false);
    stopListening();
    track(AnalyticsEvents.cook_handsfree_miss_threshold_hit, {
      recipeId,
      missCount: HANDSFREE_MISS_THRESHOLD,
      action: "turned_off",
    });
  }, [recipeId, stopListening]);

  const handleHintDismiss = useCallback(() => {
    setHintVisible(false);
    void writeHandsfreeHintSeen();
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md, padding: Spacing.xxl },
    errorText: { color: colors.text, fontSize: 16 },
    emptyHeading: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
    emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 320 },
    backBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Accent.primary, marginTop: Spacing.lg },
    backBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    // Audit 2026-04-30: Exit is navigation, not deletion. Was rendered
    // in `Accent.destructive` (red) which made users hesitate. Reserve
    // red for true destructive actions; use the standard text colour
    // here so Exit reads as "go back" rather than "discard cook".
    headerExit: { color: colors.text, fontSize: 16, fontWeight: "600" },
    headerCounter: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },

    progressBar: {
      height: 3,
      backgroundColor: colors.border,
      width: "100%",
    },
    progressBarFilled: {
      height: 3,
      backgroundColor: Accent.primary,
    },

    stepContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.xl,
    },

    stepNumber: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: Accent.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    stepNumberText: { color: Accent.primary, fontSize: 18, fontWeight: "700" },

    stepText: {
      fontSize: 17,
      fontWeight: "500",
      color: colors.text,
      textAlign: "center",
      lineHeight: 24,
    },

    timerSection: { alignItems: "center", gap: Spacing.md },
    timerDisplay: {
      fontSize: 38,
      fontWeight: "700",
      color: Accent.primary,
      fontVariant: ["tabular-nums"],
      fontFamily: "Menlo",
    },
    timerStartBtn: {
      backgroundColor: Accent.primary + "20",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
    },
    timerStartText: { color: Accent.primary, fontWeight: "600", fontSize: 15 },
    timerStopBtn: {
      backgroundColor: Accent.destructive + "20",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
    },
    timerStopText: { color: Accent.destructive, fontWeight: "600", fontSize: 15 },

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
      backgroundColor: colors.card,
      alignItems: "center",
    },
    navBtnText: { color: colors.text, fontWeight: "600", fontSize: 16 },
    navBtnDisabled: { opacity: 0.4 },
    nextBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: Radius.md,
      backgroundColor: Accent.primary,
      alignItems: "center",
    },
    nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    doneIcon: { fontSize: 48 },
    doneTitle: { fontSize: 24, fontWeight: "700", color: colors.text },
    doneSubtext: { fontSize: 14, color: colors.textSecondary },
    doneBtn: {
      marginTop: Spacing.lg,
      backgroundColor: Accent.primary,
      paddingHorizontal: Spacing.xxxl,
      paddingVertical: 14,
      borderRadius: Radius.md,
    },
    doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    // Voice handsfree toggle (Paprika parity, 2026-05-01). The mic
    // sits in the right slot of the header where the layout
    // previously held a 40-width spacer balancing the Exit button.
    // Hit area matches the spacer width so the counter stays
    // visually centred whether the toggle is on or off.
    micToggle: {
      width: 40,
      height: 32,
      borderRadius: Radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    // Subtle muted tint when off — present so users know it's
    // tappable, not so loud that it competes with the step text.
    micToggleOff: { backgroundColor: colors.card },
    // Accent tint when on so the active state is unmistakable
    // even from across the kitchen.
    micToggleOn: { backgroundColor: Accent.primary + "22" },
    // 180ms flash to a stronger tint on a recognised command.
    micToggleDetected: { backgroundColor: Accent.primary + "44" },
    // Destructive tint + amber dot accent on listener errors.
    micToggleError: { backgroundColor: Accent.destructive + "22" },
    micToggleDisabled: { opacity: 0.4 },
    handsfreeBanner: {
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.sm,
      backgroundColor: Accent.primary + "10",
      borderWidth: 1,
      borderColor: Accent.primary + "30",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    handsfreeBannerText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "600",
      flex: 1,
    },
    handsfreeBannerSub: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
    handsfreeBannerDismiss: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    handsfreeBannerDismissText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    transcriptChip: {
      alignSelf: "center",
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.full,
      backgroundColor: Accent.primary + "30",
    },
    transcriptChipText: {
      color: Accent.primary,
      fontSize: 12,
      fontWeight: "600",
    },
    deescalationStrip: {
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.sm,
      padding: Spacing.md,
      borderRadius: Radius.sm,
      backgroundColor: Accent.warning + "16",
      borderWidth: 1,
      borderColor: Accent.warning + "44",
    },
    deescalationText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
    },
    deescalationCtaRow: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    deescalationCta: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.sm,
      backgroundColor: colors.card,
    },
    deescalationCtaPrimary: { backgroundColor: Accent.primary },
    deescalationCtaText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "600",
    },
    deescalationCtaPrimaryText: { color: "#fff" },
    micErrorDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Accent.warning,
      position: "absolute",
      top: 4,
      right: 4,
    },
  }), [colors]);

  if (steps.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.emptyHeading}>No cook steps yet</Text>
          <Text style={styles.emptySub}>
            This recipe doesn&apos;t have step-by-step instructions. You can still log it from the recipe page.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back to recipe</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const progressWidth = progressWidthRef.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // Decide which mic icon + tint to render. v1 (flag off) keeps the
  // simple two-state on/off icon with no listener decoration. v2
  // (flag on) reflects the listener's live state.
  const showFeatureV2 = COOK_HANDSFREE_FEATURE_ENABLED;
  const micToggleStyle = showFeatureV2
    ? handsfreeOn
      ? micVisual === "detected"
        ? styles.micToggleDetected
        : micVisual === "error"
          ? styles.micToggleError
          : styles.micToggleOn
      : styles.micToggleOff
    : handsfreeOn
      ? styles.micToggleOn
      : styles.micToggleOff;
  const micIconColor = showFeatureV2 && micVisual === "error"
    ? Accent.destructive
    : handsfreeOn
      ? Accent.primary
      : colors.textSecondary;
  const renderMicIcon = handsfreeOn && (!showFeatureV2 || micVisual !== "error");

  // Render the toggle only if we won't violate the "don't show the
  // toggle at all if the build can't determine age safely" rule.
  // For v1 (flag off), the legacy toggle ships unchanged — the legal
  // gate doesn't apply because the feature itself isn't running.
  const showMicToggle = showFeatureV2
    ? ageGate !== "blocked_unknown" || onDeviceSupported !== null
    : true;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerExit}>Exit</Text>
        </Pressable>
        <Text style={styles.headerCounter}>Step {current + 1} of {totalSteps}</Text>
        {/* Voice handsfree toggle (Paprika parity, 2026-05-01). v1
            shipped the toggle + persistence + transparency banner.
            v2 (flag-gated) wires in the on-device listener, age
            gate, and consent sheet. Counter stays centred. */}
        {showMicToggle ? (
          <Animated.View
            style={{
              transform: [{ scale: showFeatureV2 && handsfreeOn && micVisual === "listening" ? pulseRef : 1 }],
            }}
          >
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{
                checked: handsfreeOn,
                disabled: toggleDisabled,
              }}
              accessibilityLabel={
                toggleTooltip
                  ? toggleTooltip
                  : handsfreeOn
                    ? "Voice handsfree on"
                    : "Voice handsfree off"
              }
              accessibilityHint={toggleTooltip ?? undefined}
              testID="cook-handsfree-toggle"
              onPress={handleHandsfreeToggle}
              hitSlop={8}
              disabled={toggleDisabled}
              style={[
                styles.micToggle,
                micToggleStyle,
                toggleDisabled && styles.micToggleDisabled,
              ]}
            >
              {renderMicIcon ? (
                <Mic size={18} color={micIconColor} strokeWidth={2} />
              ) : (
                <MicOff size={18} color={micIconColor} strokeWidth={2} />
              )}
              {showFeatureV2 && micVisual === "error" ? (
                <View style={styles.micErrorDot} />
              ) : null}
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressBarFilled,
            {
              width: progressWidth,
            },
          ]}
        />
      </View>

      {/* Voice handsfree banner. v1 (flag-off) renders the original
          transparency copy explaining the listener isn't live yet.
          v2 (flag-on, consent given) renders the "Listening — say
          next, back, repeat, pause, or resume" hint as a one-shot
          dismissible banner. */}
      {showFeatureV2 ? (
        handsfreeOn && consentGiven && hintVisible ? (
          <View
            style={styles.handsfreeBanner}
            accessibilityLiveRegion="polite"
            testID="cook-handsfree-banner"
          >
            <Text style={styles.handsfreeBannerText}>
              Listening. Say next, back, repeat, pause, or resume.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss listening hint"
              testID="cook-handsfree-banner-dismiss"
              onPress={handleHintDismiss}
              style={styles.handsfreeBannerDismiss}
            >
              <Text style={styles.handsfreeBannerDismissText}>Got it</Text>
            </Pressable>
          </View>
        ) : null
      ) : (
        handsfreeOn ? (
          <View
            style={styles.handsfreeBanner}
            accessibilityLiveRegion="polite"
            testID="cook-handsfree-banner"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.handsfreeBannerText}>
                Screen stays awake while you cook.
              </Text>
              <Text style={styles.handsfreeBannerSub}>
                Voice control (say &quot;next&quot;, &quot;back&quot;, &quot;repeat&quot;) is coming soon. We don&apos;t record audio yet.
              </Text>
            </View>
          </View>
        ) : null
      )}

      {/* De-escalation strip — three-miss soft cap (v2 only). */}
      {showFeatureV2 && deescalationVisible ? (
        <View style={styles.deescalationStrip} testID="cook-handsfree-deescalation">
          <Text style={styles.deescalationText}>
            Trouble hearing you. Tap Next or Previous any time, or move closer to the phone.
          </Text>
          <View style={styles.deescalationCtaRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep listening"
              testID="cook-handsfree-deescalation-keep"
              onPress={handleDeescalationKeep}
              style={[styles.deescalationCta, styles.deescalationCtaPrimary]}
            >
              <Text style={[styles.deescalationCtaText, styles.deescalationCtaPrimaryText]}>
                Keep listening
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Turn voice off"
              testID="cook-handsfree-deescalation-off"
              onPress={handleDeescalationTurnOff}
              style={styles.deescalationCta}
            >
              <Text style={styles.deescalationCtaText}>Turn voice off</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Transcript feedback chip — fires on every recognised
          command. (v2 only.) */}
      {showFeatureV2 && lastTranscript ? (
        <View style={styles.transcriptChip} testID="cook-handsfree-transcript">
          <Text style={styles.transcriptChipText}>Heard: {lastTranscript}</Text>
        </View>
      ) : null}

      {!isDone ? (
        <View style={styles.stepContainer}>
          {/* Step number */}
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{current + 1}</Text>
          </View>

          {/* Step text */}
          <Text style={styles.stepText}>{stepText}</Text>

          {/* Timer */}
          <View style={styles.timerSection}>
            {timerActive ? (
              <>
                <Text style={styles.timerDisplay}>{formatTimer(timerElapsed)}</Text>
                <Pressable style={styles.timerStopBtn} onPress={stopTimer}>
                  <Text style={styles.timerStopText}>Stop</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.timerStartBtn} onPress={startTimer}>
                <Text style={styles.timerStartText}>⏱ Start Timer</Text>
              </Pressable>
            )}
          </View>

          {/* Navigation */}
          <View style={styles.navRow}>
            <Pressable
              style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
              onPress={onPressPrev}
              disabled={current === 0}
            >
              <Text style={styles.navBtnText}>Previous</Text>
            </Pressable>
            <Pressable style={styles.nextBtn} onPress={onPressNext}>
              <Text style={styles.nextBtnText}>
                {current === totalSteps - 1 ? "Done!" : "Next Step"}
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
          {/* P2-24 (2026-04-25): Log this meal — closes the loop from cook
              back to the journal. Replace the route with the recipe detail
              + an `autoLog=1` query param; the recipe page already owns
              the journal-write logic with the coercion guard (P0-3) so we
              don't fork the write path. */}
          <Pressable
            style={styles.doneBtn}
            onPress={() => {
              if (recipeId) {
                track(AnalyticsEvents.cook_mode_log_tapped, { recipeId });
                router.replace(`/recipe/${recipeId}?autoLog=1` as never);
              } else {
                router.back();
              }
            }}
          >
            <Text style={styles.doneBtnText}>Log this meal</Text>
          </Pressable>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: "transparent", marginTop: Spacing.sm }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.doneBtnText, { color: colors.textSecondary }]}>Skip — back to recipe</Text>
          </Pressable>
        </View>
      )}

      {/* Pre-permission explainer (v2 only). Renders above all other
          surfaces via Modal. */}
      {showFeatureV2 ? (
        <CookHandsfreeConsentSheet
          visible={consentSheetVisible}
          onConsentGranted={handleConsentResolved}
          onDismiss={handleConsentDismissed}
        />
      ) : null}
    </View>
  );
}
