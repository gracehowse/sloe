/**
 * "Export everything" — mobile client.
 *
 * Hits the server-authoritative `/api/export/me` endpoint, writes
 * the JSON to a temp file under the app's cache directory, and
 * surfaces the iOS share sheet so the user can save to Files,
 * AirDrop, send via Mail, etc.
 *
 * Why a server endpoint (not direct Supabase reads on device):
 *   - Single source of truth for the export shape — web + mobile
 *     emit the same bytes.
 *   - Service-role read on the server picks up rows the client RLS
 *     might not surface in edge cases (e.g. published recipes the
 *     user authored).
 *   - Server-side rate limit means "double-tapping the row" gets a
 *     clean 429, not two duplicate downloads.
 *   - PostHog `data_export_initiated` event fires server-side with
 *     the real `sizeBytes`.
 *
 * Why iOS-native `Share.share({ url })` (not `expo-sharing`):
 *   - `expo-sharing` isn't in the dependency tree. Adding it would
 *     require a native rebuild + an EAS submission to ship.
 *   - RN's built-in `Share.share({ url: "file://..." })` opens the
 *     same iOS UIActivityViewController. The "Save to Files",
 *     "Mail", "Messages", AirDrop, and Notes activities all work
 *     against a `file://` URL with `application/json` MIME.
 *
 * iOS-only by spec; the task is iOS-only and mobile is currently
 * iOS-only on TestFlight. If Android lands later, swap to
 * `Sharing.shareAsync` (which abstracts the platform).
 */

import { Platform } from "react-native";
import { getSupprApiBase } from "./supprWeb";
import { authedFetch } from "./authedFetch";

export type ExportEverythingResult =
  | {
      ok: true;
      /** `file://` URI written to the cache directory. */
      fileUri: string;
      /** Display filename (no path). */
      filename: string;
      /** Size of the JSON body in bytes. */
      sizeBytes: number;
    }
  | {
      ok: false;
      /** Stable code for UI branching. */
      reason:
        | "not_authenticated"
        | "rate_limited"
        | "service_unavailable"
        | "network"
        | "filesystem_unavailable"
        | "write_failed"
        | "server_error";
      /** Human-readable detail. Safe to surface in an Alert. */
      message: string;
      /** HTTP status code (when applicable). */
      status?: number;
    };

/** Filename written to the device cache. Uses the date the user
 *  initiated the export so they can tell two exports apart at a
 *  glance in the Files app. */
function buildFilename(userId: string): string {
  const datePart = new Date().toISOString().slice(0, 10);
  // Trim long UUIDs to first 8 chars for a shorter filename without
  // sacrificing uniqueness in the user's Downloads folder.
  const idPart = userId.slice(0, 8);
  return `suppr-export-${idPart}-${datePart}.json`;
}

/**
 * Runs the full export-everything flow:
 *   1. Calls `GET /api/export/me` with the user's bearer token.
 *   2. Writes the body to the iOS cache directory.
 *   3. Returns the `file://` URI for the caller to hand to
 *      `Share.share({ url })`.
 *
 * The caller is responsible for the share-sheet presentation +
 * surface-level UX (loading spinner, success toast). This helper
 * never throws — every failure path returns a structured
 * `{ ok: false, reason }` so the caller can show consistent copy.
 */
export async function exportEverythingToFile(
  userId: string,
): Promise<ExportEverythingResult> {
  if (!userId) {
    return {
      ok: false,
      reason: "not_authenticated",
      message: "Sign in to export your data.",
    };
  }

  const apiBase = getSupprApiBase();
  if (!apiBase) {
    return {
      ok: false,
      reason: "service_unavailable",
      message: "Export is not available in this build.",
    };
  }

  // 1. Server fetch.
  let res: Response;
  try {
    res = await authedFetch(`${apiBase}/api/export/me`, {
      method: "GET",
      // Tag User-Agent so the server can attribute platform without
      // sniffing — keeps the analytics platform field honest.
      headers: { "user-agent": "expo-suppr-export/1" },
    });
  } catch (e) {
    return {
      ok: false,
      reason: "network",
      message:
        e instanceof Error ? e.message : "Network error — check your connection.",
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      reason: "not_authenticated",
      message: "Your session expired. Sign in and try again.",
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
    return {
      ok: false,
      reason: "server_error",
      message: detail,
      status: res.status,
    };
  }

  const body = await res.text();
  const sizeBytes = body.length;

  // 2. Write to cache. Dynamic `import` keeps unit tests (vitest
  // under node) from exploding when the optional native module
  // isn't resolvable; under vitest the test file `vi.mock()`s
  // `expo-file-system` so this resolves to the mock.
  let fsModule: unknown;
  try {
    fsModule = await import("expo-file-system");
  } catch {
    return {
      ok: false,
      reason: "filesystem_unavailable",
      message: "We couldn't access local storage to save the file.",
    };
  }
  // The expo module exports both as named bindings AND under
  // `default` depending on bundler. Probe both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fsModAny = fsModule as any;
  const cacheDir: unknown =
    fsModAny?.cacheDirectory ??
    fsModAny?.default?.cacheDirectory ??
    fsModAny?.documentDirectory ??
    fsModAny?.default?.documentDirectory;
  const writeAsStringAsync: unknown =
    fsModAny?.writeAsStringAsync ?? fsModAny?.default?.writeAsStringAsync;

  if (typeof cacheDir !== "string" || !cacheDir) {
    return {
      ok: false,
      reason: "filesystem_unavailable",
      message: "We couldn't access local storage to save the file.",
    };
  }
  if (typeof writeAsStringAsync !== "function") {
    return {
      ok: false,
      reason: "filesystem_unavailable",
      message: "We couldn't access local storage to save the file.",
    };
  }

  const filename = buildFilename(userId);
  const fileUri = `${cacheDir.replace(/\/$/, "")}/${filename}`;

  try {
    await (writeAsStringAsync as (uri: string, body: string) => Promise<void>)(
      fileUri,
      body,
    );
  } catch (e) {
    return {
      ok: false,
      reason: "write_failed",
      message:
        e instanceof Error
          ? `Couldn't save to your device: ${e.message}`
          : "Couldn't save the export to your device.",
    };
  }

  return { ok: true, fileUri, filename, sizeBytes };
}

/** Exported for tests — keeps the filename pure-fn assertable. */
export const _buildExportFilename = buildFilename;

/** Platform check — the spec is iOS-only. Centralised so the row
 *  can hide on web (`react-native-web`) and Android dev builds. */
export function isExportEverythingSupported(): boolean {
  return Platform.OS === "ios";
}
