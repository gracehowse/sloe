/**
 * Device-scoped "a session has existed on this install" marker (ENG-1514).
 *
 * A fresh install lands on the ROOT login screen with no way to tell whether
 * the person is new (the overwhelmingly common case) or returning — so the
 * email form used to default to "Welcome back — Sign In". This marker is
 * written the first time ANY session is observed (`context/auth.tsx`) and
 * deliberately SURVIVES sign-out — it is intentionally NOT in
 * `clearUserScopedStorage.ts`'s wipe list (not a gap): it carries no user
 * data and only flips the email form's default between "Create your account"
 * (marker absent → fresh install) and "Welcome back" (marker present).
 *
 * Web parity: web's `app/login/ui.tsx` takes an explicit `initialMode` from
 * its /signin and /signup routes — the fresh-install signal is inherently a
 * device concept, so no web change is needed.
 */
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";

export const HAS_SIGNED_IN_BEFORE_KEY = "suppr.has_signed_in_before";

/** Fire-and-forget: record that a real session existed on this device. */
export function markHasSignedInBefore(): void {
  void AsyncStorage.setItem(HAS_SIGNED_IN_BEFORE_KEY, "1").catch(() => {
    // Best-effort — worst case the email form defaults to Create once more.
  });
}

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Pure decision (exported for unit tests): the email form defaults to
 * sign-UP unless a "returning user" signal is present — `?intent=signin`
 * (onboarding welcome's "I already have an account") or the device marker.
 */
export function emailEntryDefaultsToSignUp(
  intent: string | string[] | undefined,
  signedInBefore: boolean,
): boolean {
  return firstParam(intent) !== "signin" && !signedInBefore;
}

/**
 * Default mode for the login email form at the moment the chooser's
 * "Continue with email" is tapped: `true` → sign-UP (create account).
 */
export function useEmailEntrySignUpDefault(): boolean {
  const { intent } = useLocalSearchParams<{ intent?: string | string[] }>();
  const [signedInBefore, setSignedInBefore] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(HAS_SIGNED_IN_BEFORE_KEY)
      .then((v) => {
        if (!cancelled && v === "1") setSignedInBefore(true);
      })
      .catch(() => {
        // Unreadable storage reads as "fresh install" — the safe default.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return emailEntryDefaultsToSignUp(intent, signedInBefore);
}
