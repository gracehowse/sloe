/**
 * Siri-shortcut deep links — Batch 5.12.
 *
 * The Suppr iOS app exposes three Shortcuts-app-friendly deep links that
 * users can wire into Siri / the Shortcuts app without any native Siri
 * Intent extension:
 *
 *   suppr://log/water?ml=250    → add N ml of water to today's hydration
 *   suppr://fast/start?hours=16 → start an intermittent fast of N hours
 *   suppr://today/remaining     → open Today tab (used by widget taps too)
 *
 * This helper is pure — it parses a string URL into a typed `SiriAction`
 * or returns `null` for anything malformed / unknown. Platform side-effects
 * (state mutations, navigation) live in the mobile `_layout.tsx` handler.
 *
 * Parity note: web does not honour the `suppr://` scheme — this is an
 * iOS-primary feature. Helper lives in `src/lib/nutrition/` anyway so the
 * schema + default constants are owned in one place and the mobile wrapper
 * `apps/mobile/lib/siriDeepLinks.ts` re-exports for the alias import path.
 */

export type SiriAction =
  | { kind: "log_water"; ml: number }
  | { kind: "start_fast"; hours: number }
  | { kind: "today_remaining" };

/** Default volume for `suppr://log/water` when no `?ml=` is supplied. */
export const SIRI_DEFAULT_WATER_ML = 250;

/** Default fast length for `suppr://fast/start` when no `?hours=` is supplied. */
export const SIRI_DEFAULT_FAST_HOURS = 16;

/** Clamp bounds — defensive against Shortcuts-app typos and maliciously
 *  long deep links. A user can always log more water by invoking the
 *  shortcut twice. */
const MAX_WATER_ML = 5000;
const MIN_WATER_ML = 1;

const MAX_FAST_HOURS = 48;
const MIN_FAST_HOURS = 1;

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Parse an incoming `suppr://…` deep-link URL into a typed Siri action.
 * Returns `null` for any URL that can't be parsed, isn't the `suppr`
 * scheme, or doesn't match a known host / path.
 *
 * Uses the WHATWG `URL` class (available on React Native and Node 18+) —
 * no regexes, no bespoke parsing.
 */
export function parseSiriDeepLink(input: unknown): SiriAction | null {
  if (typeof input !== "string" || input.length === 0) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  // The scheme property includes the trailing colon, e.g. "suppr:".
  if (url.protocol.replace(/:$/, "").toLowerCase() !== "suppr") return null;

  const host = url.hostname.toLowerCase();
  // `URL` strips a leading slash from the pathname for non-http schemes on
  // some runtimes and keeps it on others. Normalise both ends.
  const path = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();

  // `suppr://log/water?ml=250`
  if (host === "log" && path === "water") {
    const rawParam = url.searchParams.get("ml");
    // A present-but-blank param falls back to default; a present-but-invalid
    // param is treated as hostile and rejected so we never log a surprise
    // amount when someone typos the shortcut.
    const hasParam = rawParam != null && rawParam.trim() !== "";
    if (hasParam) {
      const n = Number(rawParam);
      if (!Number.isFinite(n)) return null;
      const ml = Math.round(n);
      if (ml < MIN_WATER_ML) return null;
      return { kind: "log_water", ml: clamp(ml, MIN_WATER_ML, MAX_WATER_ML) };
    }
    return { kind: "log_water", ml: SIRI_DEFAULT_WATER_ML };
  }

  // `suppr://fast/start?hours=16`
  if (host === "fast" && path === "start") {
    const rawParam = url.searchParams.get("hours");
    const hasParam = rawParam != null && rawParam.trim() !== "";
    if (hasParam) {
      const n = Number(rawParam);
      if (!Number.isFinite(n)) return null;
      const hours = Math.round(n);
      if (hours < MIN_FAST_HOURS) return null;
      return { kind: "start_fast", hours: clamp(hours, MIN_FAST_HOURS, MAX_FAST_HOURS) };
    }
    return { kind: "start_fast", hours: SIRI_DEFAULT_FAST_HOURS };
  }

  // `suppr://today/remaining`
  if (host === "today" && path === "remaining") {
    return { kind: "today_remaining" };
  }

  return null;
}

/**
 * Canonical deep-link URLs — exported so the documentation,
 * Siri donation code (when the native library is wired), and user-facing
 * copy share one source of truth. Passing an argument overrides the default.
 */
export function buildLogWaterUrl(ml: number = SIRI_DEFAULT_WATER_ML): string {
  const clamped = clamp(Math.round(ml), MIN_WATER_ML, MAX_WATER_ML);
  return `suppr://log/water?ml=${clamped}`;
}

export function buildStartFastUrl(hours: number = SIRI_DEFAULT_FAST_HOURS): string {
  const clamped = clamp(Math.round(hours), MIN_FAST_HOURS, MAX_FAST_HOURS);
  return `suppr://fast/start?hours=${clamped}`;
}

export const TODAY_REMAINING_URL = "suppr://today/remaining";
