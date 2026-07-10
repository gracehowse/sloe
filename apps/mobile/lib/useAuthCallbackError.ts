/**
 * Surfaces an auth-callback failure forwarded from the `suppr://auth-callback`
 * deep-link handler (ENG-1474).
 *
 * `app/auth-callback.tsx` routes a missing / failed PKCE code exchange to
 * `/login?error=oauth[&error_description=…]` — mirroring web's `/auth/callback`
 * → `/login?error=oauth`. This hook reads those params off the login route and
 * pushes a user-facing string into login's existing `message` state, so a
 * broken sign-in link never fails silently.
 *
 * Extracted from `login.tsx` (rather than inlined) to keep that legacy screen
 * shrinking toward the 400-line target and to make the mapping unit-testable
 * without rendering the whole login surface.
 */
import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Map the forwarded `error` / `error_description` params to a display string. */
export function authCallbackErrorMessage(
  errorCode: string | undefined,
  errorDetail: string | undefined,
): string | null {
  if (!errorCode) return null;
  return errorDetail?.trim() || "That sign-in link didn't work. Try again below.";
}

/**
 * Reads the login route's `?error=` params and, when present, seeds the
 * caller's message state via `setMessage`. No-op when no error is forwarded.
 */
export function useAuthCallbackError(setMessage: (msg: string) => void): void {
  const { error, error_description } = useLocalSearchParams<{
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const errorCode = firstParam(error);
  const errorDetail = firstParam(error_description);
  useEffect(() => {
    const msg = authCallbackErrorMessage(errorCode, errorDetail);
    if (msg) setMessage(msg);
    // `setMessage` is a stable state setter; params drive the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorCode, errorDetail]);
}
