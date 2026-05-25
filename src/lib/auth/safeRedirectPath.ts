/**
 * Sanitises a post-auth `next` redirect target (ENG-729).
 *
 * Only same-origin relative paths are allowed. Everything else — absolute URLs,
 * protocol-relative `//host`, and backslash tricks (`/\`, `\\host`) that
 * `new URL()` / browsers treat as external — falls back to "/". This blocks an
 * open-redirect via `…/auth/callback?next=//evil.com`, where the naive
 * `next.startsWith("/")` guard passes (`"//evil.com".startsWith("/")` is true).
 *
 * Lives in its own module — NOT exported from `app/auth/callback/route.ts` —
 * because Next.js route modules only permit HTTP-handler + config exports; an
 * extra export fails `next build` with "Route does not match the required
 * types of a Next.js Route" (caught only by the build, not `tsc`).
 */
export function safeAuthRedirectPath(next: string | null | undefined): string {
  const candidate = next?.trim() || "/";
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\")
  ) {
    return "/";
  }
  return candidate;
}
