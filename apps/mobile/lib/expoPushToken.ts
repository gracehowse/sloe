/**
 * Expo push token lifecycle (TestFlight build 7 fix —
 * `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`).
 *
 * Before this module landed, `notifications-prompt.tsx` requested the OS
 * permission and stored nothing — no Expo push token was ever fetched,
 * the server had no address to push to, and the prompt re-fired forever
 * because client-side suppression was never written.
 *
 * Three responsibilities, one place:
 *
 *   1. `registerExpoPushTokenForUser` — call after `requestPermissionsAsync`
 *      reports `granted`. Reads the EAS project ID from `app.json`
 *      (`expo.extra.eas.projectId`, mirroring how `lib/supabase.ts`
 *      reads its config), fetches the push token, writes it to
 *      `profiles.expo_push_token`, and caches it locally so the
 *      refresh path can short-circuit when nothing has changed.
 *
 *   2. `refreshExpoPushTokenIfChanged` — call from a focus effect (see
 *      `apps/mobile/app/(tabs)/index.tsx`). Cheap when nothing has
 *      changed; rotates the column when Expo issues a new token across
 *      a reinstall or restore-from-backup.
 *
 *   3. `markNotificationsPromptDismissed` /
 *      `hasNotificationsPromptBeenDismissed` — owns the
 *      `NOTIFICATIONS_PROMPT_DISMISSED_KEY` AsyncStorage flag so the
 *      prompt screen and any future re-entry point share one source of
 *      truth on whether to show the prompt again.
 *
 * Failure handling: every entry point swallows expected errors via
 * `console.warn` so a token-fetch failure (no network, simulator,
 * RLS hiccup) never crashes the host screen — the user can retry on
 * next launch.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

/**
 * F-151 (2026-05-10) — emit a typed PostHog event on every push-token
 * registration attempt so the next "notifications don't work" tester
 * report is correlated to a concrete failure code, not an opaque
 * console.warn the user can never see.
 *
 * Outcome buckets mirror the `RegisterResult.reason` union plus an
 * `ok` for success. `surface` distinguishes the prompt path
 * (`registerExpoPushTokenForUser`) from the focus-refresh path
 * (`refreshExpoPushTokenIfChanged`). `error_message` is populated
 * for `fetch_failed` / `db_failed` so we can see WHY without
 * surfacing it to the user.
 */
type RegisterTelemetry = {
  outcome: "ok" | "no_user" | "no_project_id" | "fetch_failed" | "db_failed" | "no_permission" | "no_change";
  surface: "register" | "refresh";
  error_message?: string;
};
function trackRegister(props: RegisterTelemetry): void {
  try {
    track("expo_push_token_register_attempted", props);
  } catch {
    /* analytics never blocks the registration flow */
  }
}

/** AsyncStorage key — single source of truth for prompt suppression. */
export const NOTIFICATIONS_PROMPT_DISMISSED_KEY = "notifications_prompt_dismissed_v1";

/** Local cache key — last token we successfully wrote to Supabase. */
export const LAST_PUSH_TOKEN_CACHE_KEY = "expo_push_token_last_synced_v1";

type ExtraWithEas = {
  eas?: {
    projectId?: string;
  };
};

function readEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as ExtraWithEas | undefined;
  const projectId = extra?.eas?.projectId;
  return typeof projectId === "string" && projectId.length > 0 ? projectId : undefined;
}

/**
 * Persist the AsyncStorage suppression flag. Called on both grant and
 * denial paths so the user is never re-nagged regardless of which way
 * they decided.
 */
export async function markNotificationsPromptDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_PROMPT_DISMISSED_KEY, "true");
  } catch (err) {
    console.warn("[expoPushToken] failed to persist dismiss flag", err);
  }
}

/**
 * Returns true if the user has already responded to the OS prompt and
 * we should NOT show the in-app explainer again. Either:
 *   - the AsyncStorage flag is set (we have shown the prompt before), OR
 *   - the OS already reports `granted` / `denied` so the explainer is
 *     redundant (the user can flip via Settings).
 */
export async function hasNotificationsPromptBeenDismissed(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_PROMPT_DISMISSED_KEY);
    if (stored === "true") return true;
  } catch (err) {
    console.warn("[expoPushToken] failed to read dismiss flag", err);
  }
  try {
    const Notifications = await import("expo-notifications");
    const perm = await Notifications.getPermissionsAsync();
    return perm.status === "granted" || perm.status === "denied";
  } catch {
    // expo-notifications is unavailable (Expo Go, web, broken native
    // module) — fall through and let the caller render the explainer
    // so the user has a path to enable later.
    return false;
  }
}

type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; reason: "no_user" | "no_project_id" | "fetch_failed" | "db_failed" };

/**
 * Fetch the Expo push token and write it to `profiles.expo_push_token`.
 * Caller is responsible for confirming OS permission was granted before
 * invoking this — we do not re-prompt here.
 */
export async function registerExpoPushTokenForUser(
  userId: string | null | undefined,
): Promise<RegisterResult> {
  if (!userId) {
    trackRegister({ outcome: "no_user", surface: "register" });
    return { ok: false, reason: "no_user" };
  }

  const projectId = readEasProjectId();
  if (!projectId) {
    console.warn(
      "[expoPushToken] missing expo.extra.eas.projectId in app.json — cannot fetch push token",
    );
    trackRegister({ outcome: "no_project_id", surface: "register" });
    return { ok: false, reason: "no_project_id" };
  }

  let token: string;
  try {
    const Notifications = await import("expo-notifications");
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (err) {
    console.warn("[expoPushToken] getExpoPushTokenAsync failed", err);
    trackRegister({
      outcome: "fetch_failed",
      surface: "register",
      error_message: (err as Error)?.message ?? undefined,
    });
    return { ok: false, reason: "fetch_failed" };
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ expo_push_token: token })
      .eq("id", userId);
    if (error) {
      console.warn("[expoPushToken] failed to write profiles.expo_push_token", error.message);
      trackRegister({
        outcome: "db_failed",
        surface: "register",
        error_message: error.message ?? undefined,
      });
      return { ok: false, reason: "db_failed" };
    }
  } catch (err) {
    console.warn("[expoPushToken] supabase update threw", err);
    trackRegister({
      outcome: "db_failed",
      surface: "register",
      error_message: (err as Error)?.message ?? undefined,
    });
    return { ok: false, reason: "db_failed" };
  }

  // Remember the value we just wrote so refresh() can no-op when
  // nothing has changed.
  try {
    await AsyncStorage.setItem(LAST_PUSH_TOKEN_CACHE_KEY, token);
  } catch (err) {
    console.warn("[expoPushToken] failed to cache last token locally", err);
  }

  trackRegister({ outcome: "ok", surface: "register" });
  return { ok: true, token };
}

/**
 * Idempotent refresh — call from a focus effect. If the OS reports
 * `granted`, fetch the current push token. If it differs from the
 * locally-cached value, write the new one to Supabase. No-ops on every
 * other path so it is safe to call on every focus.
 */
export async function refreshExpoPushTokenIfChanged(
  userId: string | null | undefined,
): Promise<void> {
  if (!userId) {
    trackRegister({ outcome: "no_user", surface: "refresh" });
    return;
  }
  try {
    const Notifications = await import("expo-notifications");
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") {
      trackRegister({ outcome: "no_permission", surface: "refresh" });
      return;
    }
  } catch {
    // expo-notifications unavailable — silently skip. Don't fire
    // telemetry on Expo Go / web — that just floods PostHog.
    return;
  }

  const projectId = readEasProjectId();
  if (!projectId) {
    trackRegister({ outcome: "no_project_id", surface: "refresh" });
    return;
  }

  let currentToken: string;
  try {
    const Notifications = await import("expo-notifications");
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    currentToken = result.data;
  } catch (err) {
    console.warn("[expoPushToken] focus-refresh getExpoPushTokenAsync failed", err);
    trackRegister({
      outcome: "fetch_failed",
      surface: "refresh",
      error_message: (err as Error)?.message ?? undefined,
    });
    return;
  }

  let cached: string | null = null;
  try {
    cached = await AsyncStorage.getItem(LAST_PUSH_TOKEN_CACHE_KEY);
  } catch {
    cached = null;
  }
  if (cached === currentToken) {
    trackRegister({ outcome: "no_change", surface: "refresh" });
    return;
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ expo_push_token: currentToken })
      .eq("id", userId);
    if (error) {
      console.warn(
        "[expoPushToken] focus-refresh failed to update profiles.expo_push_token",
        error.message,
      );
      trackRegister({
        outcome: "db_failed",
        surface: "refresh",
        error_message: error.message ?? undefined,
      });
      return;
    }
  } catch (err) {
    console.warn("[expoPushToken] focus-refresh supabase update threw", err);
    trackRegister({
      outcome: "db_failed",
      surface: "refresh",
      error_message: (err as Error)?.message ?? undefined,
    });
    return;
  }

  try {
    await AsyncStorage.setItem(LAST_PUSH_TOKEN_CACHE_KEY, currentToken);
  } catch {
    // best-effort; next refresh will retry.
  }
  trackRegister({ outcome: "ok", surface: "refresh" });
}
