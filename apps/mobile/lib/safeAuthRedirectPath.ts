/**
 * Sanitises a post-auth `next` deep-link redirect target on mobile
 * (ENG-1474 — mirrors web's `src/lib/auth/safeRedirectPath.ts`).
 *
 * The `suppr://auth-callback` handler receives `next` from an incoming
 * deep link, which a malicious sender could set to an attacker-controlled
 * value. Only same-app relative paths are allowed. Everything else —
 * absolute URLs (`https://evil.com`), custom-scheme links
 * (`suppr://…`, `javascript:…`), protocol-relative `//host`, and
 * backslash tricks (`/\`, `\\host`) — falls back to the default in-app
 * home so a link can never route (or `Linking.openURL`) out of the app.
 *
 * Default is `/(tabs)` — the mobile equivalent of web's `/`: the
 * signed-in home. `/onboarding` is a legitimate relative target and
 * passes through unchanged.
 */
export const DEFAULT_AUTH_REDIRECT_PATH = "/(tabs)";

export function safeAuthRedirectPath(next: string | null | undefined): string {
  const candidate = next?.trim() || DEFAULT_AUTH_REDIRECT_PATH;
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\")
  ) {
    return DEFAULT_AUTH_REDIRECT_PATH;
  }
  return candidate;
}
