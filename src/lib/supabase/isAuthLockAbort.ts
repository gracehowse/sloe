/**
 * `@supabase/ssr` (and `@supabase/auth-js` underneath it) wraps the
 * session-refresh critical section with `navigator.locks.request`. When
 * two browser-side queries fire in parallel and both need to refresh
 * the auth token, the second will *steal* the lock and the first's
 * promise rejects with `AbortError: Lock was stolen by another request`.
 *
 * The error is benign — the data fetch is unaffected and the next call
 * succeeds normally — but the wrapped error message bleeds into our
 * downstream `console.error` logs and pollutes the dev console.
 *
 * Use this helper in any browser-side `{ data, error } = await
 * supabase.from(...).select(...)` callsite that runs frequently
 * enough to race the auth lock (Today refresh, Discover refresh,
 * etc.) so we can skip the noise without swallowing real failures.
 */
export function isAuthLockAbort(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: unknown; message?: unknown; code?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  const name = typeof e.name === "string" ? e.name : "";
  if (name === "AbortError") return true;
  // The Supabase wrapper sometimes preserves the auth-js message
  // verbatim, sometimes re-formats. Match on the stable substring.
  if (message.includes("Lock was stolen by another request")) return true;
  // Known related variants — `acquire`/`release` failures during the
  // same auth-lock window. Conservative match: also includes "lock"
  // alongside "auth" or "stolen" to avoid swallowing genuine errors
  // that mention the word "lock" for unrelated reasons (account
  // lockouts, lock files, etc.).
  if (
    message.toLowerCase().includes("lock") &&
    (message.toLowerCase().includes("stolen") ||
      message.toLowerCase().includes("aborted"))
  ) {
    return true;
  }
  return false;
}
