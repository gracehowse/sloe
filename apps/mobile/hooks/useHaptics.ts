import { useCallback } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * useHaptics — Canonical 2026-05-22 lock.
 *
 * Premium products haptic on EVERY interaction. Cal AI does, MacroFactor
 * does, Apple's own apps do. Suppr had haptics in ~30 files but every
 * component invented its own notification-async call,
 * leading to inconsistent intensities across the same interaction
 * category (e.g. some chips tap-haptic, others don't).
 *
 * Semantic methods (intensity matched to interaction meaning):
 *   - `.tap()`     — non-state-changing tap (button press, FAB press)
 *   - `.select()`  — segmented control / pill selection / day strip
 *   - `.success()` — meal logged, plan saved, trial started
 *   - `.warn()`    — about to do something destructive
 *   - `.confirm()` — completed destructive action (e.g. end fast,
 *                    delete meal)
 *   - `.heavy()`   — large state change (purchase complete, milestone)
 *
 * Single source of truth — when Apple ships a new feedback type, this
 * file changes once and the whole app re-tunes.
 *
 * Web: methods are no-ops (haptics aren't a web concept). Safe to use
 * cross-platform without `if (Platform.OS === "ios")` ceremony.
 *
 * Android: expo-haptics maps to the closest VibrationEffect.
 *
 * Usage:
 *   Prefer `PressableScale`'s `haptic` prop for tap targets (ENG-1342).
 *   Use this hook for programmatic feedback after async success/failure
 *   (e.g. meal logged, save completed) where there is no press-in moment.
 *
 *   const haptics = useHaptics();
 *   await save(); haptics.success();
 */
export function useHaptics() {
  const isIos = Platform.OS === "ios";
  const isAndroid = Platform.OS === "android";
  const enabled = isIos || isAndroid;

  const tap = useCallback(() => {
    if (!enabled) return;
    void Haptics.selectionAsync();
  }, [enabled]);

  const select = useCallback(() => {
    if (!enabled) return;
    void Haptics.selectionAsync();
  }, [enabled]);

  const success = useCallback(() => {
    if (!enabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [enabled]);

  const warn = useCallback(() => {
    if (!enabled) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [enabled]);

  const confirm = useCallback(() => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [enabled]);

  const heavy = useCallback(() => {
    if (!enabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [enabled]);

  return { tap, select, success, warn, confirm, heavy };
}

export default useHaptics;
