/**
 * Web "Export everything" client helper.
 *
 * Hits the server-authoritative `GET /api/export/me` endpoint and triggers a
 * browser blob download of the COMPLETE archive (profile, recipes + ingredients,
 * saves, meal log, weight history, custom foods, plan days + meals, shopping,
 * saved meals + items, recipe notes). This is the same endpoint mobile calls via
 * `exportEverythingToFile`, so the bytes are identical across platforms.
 *
 * Extracted from `Settings.tsx` (ENG-1262) so BOTH the standalone Settings
 * "Export everything" row AND the DeleteAccount "Download a copy first" action
 * call one tested helper rather than two inlined, drifting copies. Before
 * ENG-1262 the delete-flow export called a meal-log-only CSV — handing the user
 * a partial archive right before permanent deletion (a GDPR Art. 20 portability
 * gap). This helper is the authoritative complete-archive path.
 *
 * Never throws — every failure path returns a structured `{ ok: false, reason }`
 * so callers can branch on a stable code and surface consistent copy.
 */

export type ExportEverythingWebResult =
  | { ok: true; filename: string; sizeBytes: number }
  | {
      ok: false;
      reason:
        | "not_authenticated"
        | "rate_limited"
        | "service_unavailable"
        | "network"
        | "server_error";
      /** Human-readable detail, safe to surface in a toast. */
      message: string;
      /** HTTP status (when the failure came from a response). */
      status?: number;
    };

/** Minimal shape we need from a Supabase browser client — kept narrow so the
 *  helper is trivially mockable in unit tests without the full SDK type. */
export interface ExportSessionProvider {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token?: string } | null };
    }>;
  };
}

/** Pull the bearer token from the active Supabase session. The route also
 *  accepts `sb-*` cookies, but sending the bearer explicitly keeps cookie-less
 *  SPA sessions authenticating cleanly. */
async function getAccessToken(
  client: ExportSessionProvider,
): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function parseFilename(contentDisposition: string | null): string {
  const match = /filename="([^"]+)"/.exec(contentDisposition ?? "");
  return (
    match?.[1] ?? `sloe-export-${new Date().toISOString().slice(0, 10)}.json`
  );
}

/**
 * Fetches the complete export and triggers a browser download.
 *
 * @param client  Supabase browser client (only `auth.getSession` is used).
 * @returns A structured result the caller maps to UI (toast + spinner).
 */
export async function downloadSupprExport(
  client: ExportSessionProvider,
): Promise<ExportEverythingWebResult> {
  const token = await getAccessToken(client);
  if (!token) {
    return {
      ok: false,
      reason: "not_authenticated",
      message: "Sign in to export your data.",
    };
  }

  let res: Response;
  try {
    res = await fetch("/api/export/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    return {
      ok: false,
      reason: "network",
      message:
        e instanceof Error
          ? e.message
          : "Network error — check your connection and try again.",
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      reason: "not_authenticated",
      message: "Your session expired. Sign in again.",
      status: 401,
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      reason: "rate_limited",
      message: "You can export once per minute. Try again in a moment.",
      status: 429,
    };
  }
  if (res.status === 503) {
    return {
      ok: false,
      reason: "service_unavailable",
      message: "Export is temporarily unavailable. Try again later.",
      status: 503,
    };
  }
  if (!res.ok) {
    let detail = `Export failed (${res.status}).`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      // Body wasn't JSON — keep the generic message.
    }
    return { ok: false, reason: "server_error", message: detail, status: res.status };
  }

  const blob = await res.blob();
  const filename = parseFilename(res.headers.get("content-disposition"));

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }

  return { ok: true, filename, sizeBytes: blob.size };
}
