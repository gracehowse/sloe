import { NextResponse } from "next/server";

/**
 * CSRF defence — verify the `Origin` header matches our configured app URL.
 *
 * Applied to state-changing (POST/PUT/PATCH/DELETE) cookie-authenticated
 * routes. Server-to-server callers (cron, native mobile app) typically
 * omit `Origin` entirely, so a missing header is allowed — the
 * per-request Authorization: Bearer token path remains the auth gate
 * for those callers.
 *
 * Returns a 403 NextResponse when the `Origin` header is present but
 * does not match `NEXT_PUBLIC_APP_URL`. Returns `null` otherwise.
 *
 * Usage:
 *   const bad = assertOrigin(req);
 *   if (bad) return bad;
 */
export function assertOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  // Server-to-server / native mobile calls typically omit Origin.
  // Those paths authenticate via Authorization: Bearer, not cookies,
  // so CSRF does not apply. Only enforce when Origin is present.
  if (!origin) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    // If the app URL is not configured we cannot verify. Fail closed:
    // reject cross-origin-looking requests to avoid a misconfiguration
    // silently disabling CSRF protection.
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "NEXT_PUBLIC_APP_URL unset" },
      { status: 503 },
    );
  }

  const normaliseOrigin = (u: string): string => {
    try {
      const parsed = new URL(u);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return u.replace(/\/$/, "");
    }
  };

  if (normaliseOrigin(origin) !== normaliseOrigin(appUrl)) {
    return NextResponse.json(
      { ok: false, error: "forbidden_origin" },
      { status: 403 },
    );
  }
  return null;
}
