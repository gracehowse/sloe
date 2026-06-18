/**
 * Defence-in-depth validation for Web Push endpoint URLs (ENG-1153).
 *
 * The `claim_web_push_subscription` RPC intentionally deletes any row
 * matching the endpoint (cross-user browser reclaim). Before calling it,
 * the client must prove the endpoint came from the browser's own
 * PushManager subscription — not an attacker-supplied string.
 */

/** Known push-service host suffixes (FCM, Mozilla, Apple). */
const PUSH_HOST_SUFFIXES = [
  ".push.services.mozilla.com",
  ".fcm.googleapis.com",
  ".push.apple.com",
  "updates.push.services.mozilla.com",
] as const;

/**
 * Returns true when `endpoint` looks like a legitimate Web Push subscription
 * URL from a known push service over HTTPS.
 */
export function isValidWebPushEndpoint(endpoint: string): boolean {
  const trimmed = endpoint.trim();
  if (!trimmed) return false;
  if (trimmed.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some(
    (suffix) => host === suffix.replace(/^\./, "") || host.endsWith(suffix),
  );
}
