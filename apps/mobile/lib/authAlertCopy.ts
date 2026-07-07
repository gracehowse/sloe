/**
 * ENG-1378 — one auth-gate alert, one voice.
 *
 * Before this module, "you need to sign in to do X" existed as five+
 * independently-typed variants across household-settings.tsx,
 * TodayScreen.tsx, QuickAddPanel.tsx, planner.tsx, barcode.tsx, cook.tsx,
 * and create-recipe.tsx — some titled "Sign in", one titled "Sign in
 * needed", and two phrased as "You need to be signed in to X" instead of
 * "Sign in to X.". Same concept (the user hit an auth-gated action while
 * signed out), five different sentences. `signInToAlert(action)` is the
 * single templated source so every call site renders byte-identical
 * copy for the same action shape.
 *
 * `action` is the lowercase verb phrase that completes "Sign in to
 * {action}." — e.g. `"save favourites"`, `"log food to your tracker"`.
 * Callers own picking the right verb phrase for their gate; this module
 * only owns the sentence shape + title, so a future voice change (or a
 * copy-voice ratchet rule) only has one place to fix.
 */
import { Alert } from "react-native";

export interface SignInAlertCopy {
  title: string;
  message: string;
}

/**
 * Build the `{ title, message }` pair for `Alert.alert(title, message)`.
 * `action` must NOT include a trailing period — this appends one.
 *
 *   signInToAlert("save favourites")
 *     -> { title: "Sign in", message: "Sign in to save favourites." }
 */
export function signInToAlert(action: string): SignInAlertCopy {
  return { title: "Sign in", message: `Sign in to ${action}.` };
}

/**
 * The bare message string, for call sites that render inline copy
 * (a `<Text>` empty-state, an `EmptyState` `title` prop, a hook's
 * `{ ok: false, error }` return) rather than firing `Alert.alert`.
 * Identical wording to `signInToAlert(action).message` so the two
 * surfaces never drift from each other.
 */
export function signInToMessage(action: string): string {
  return signInToAlert(action).message;
}

/**
 * Fire the alert directly — the one-line convenience for the common
 * `if (!userId) { showSignInAlert("..."); return; }` shape. Equivalent
 * to `Alert.alert(...Object.values(signInToAlert(action)))` but reads
 * as a verb, not a data-shape puzzle.
 */
export function showSignInAlert(action: string): void {
  const { title, message } = signInToAlert(action);
  Alert.alert(title, message);
}
