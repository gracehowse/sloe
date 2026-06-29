/**
 * AI-method discoverability tooltip gate (ENG-1252) — shared pure helper
 * deciding whether the first-session "AI logging — available with Pro."
 * tooltip should surface under the locked Voice / Snap chip in the LogSheet
 * `InputModeRow`.
 *
 * The goal is MFP-refugee discoverability: a brand-new free-tier user opens
 * the Log sheet and may not realise Voice / Snap exist (they're locked) — a
 * one-line inline tooltip on their first few sessions points at the gated
 * affordance without nagging forever.
 *
 * Gate rule — ALL must hold:
 *   1. Feature flag `logsheet_ai_method_tooltip` is ON (default-OFF; ramped
 *      via PostHog).
 *   2. The user is on a non-Pro tier ("free" or "base"). Pro users already
 *      have the feature unlocked — no tooltip.
 *   3. The user is within their first {@link MAX_TOOLTIP_SESSION} app
 *      sessions (1, 2, or 3). Sessions 4+ → no tooltip (the user has had
 *      enough chances to notice).
 *
 * No React, no storage, no network. Callers pass in what they already have
 * in state. Web (`localStorage`) and mobile (`AsyncStorage`) both consume
 * this file; all session-count persistence happens in the caller via
 * {@link nextSessionNumber}.
 */

/** Pro-tier slug — the only tier with AI logging unlocked. */
export const AI_TOOLTIP_PRO_TIER = "pro" as const;

/**
 * Highest session number that still shows the tooltip. Sessions 1..3 show
 * it; session 4 onward does not. "~3 sessions" per the ENG-1252 brief.
 */
export const MAX_TOOLTIP_SESSION = 3 as const;

/** Feature flag key — registered default-OFF on both platforms. */
export const AI_METHOD_TOOLTIP_FLAG = "logsheet_ai_method_tooltip" as const;

/**
 * Persistence key for the per-device session counter. Versioned so the
 * gate can be reset cleanly if the threshold ever changes.
 *
 * Stored value is a base-10 integer string; missing / malformed reads are
 * treated as 0 sessions seen.
 */
export const AI_METHOD_TOOLTIP_SESSION_KEY =
  "suppr-logsheet-ai-tooltip-session-v1";

/** User-facing tooltip copy. Single source so web ↔ mobile never drift. */
export const AI_METHOD_TOOLTIP_TEXT = "AI logging — available with Pro." as const;

export type AiMethodTooltipInput = {
  /** Resolved value of `isFeatureEnabled("logsheet_ai_method_tooltip")`. */
  flagOn: boolean;
  /** The user's billing tier ("free" / "base" / "pro"). */
  userTier: string;
  /**
   * 1-based count of how many times the user has opened the app (or the
   * relevant session boundary) on this device. The caller increments and
   * persists this via {@link nextSessionNumber}; the very first session is
   * `1`. Values <= 0 are treated as "not yet a real session" → no tooltip.
   */
  sessionNumber: number;
};

/**
 * Decide whether the AI-method discoverability tooltip should render.
 * Returns `false` for any failed gate condition — never throws.
 */
export function shouldShowAiMethodTooltip(input: AiMethodTooltipInput): boolean {
  const { flagOn, userTier, sessionNumber } = input;
  if (!flagOn) return false;
  // Pro already has AI logging — no discoverability nudge needed.
  if (userTier === AI_TOOLTIP_PRO_TIER) return false;
  // First ~3 sessions only; sessions 4+ get nothing.
  if (!Number.isFinite(sessionNumber)) return false;
  if (sessionNumber < 1) return false;
  if (sessionNumber > MAX_TOOLTIP_SESSION) return false;
  return true;
}

/**
 * Parse a persisted session-count string into a non-negative integer.
 * Defensive: missing / NaN / negative reads collapse to 0.
 */
export function parseSessionCount(raw: string | null | undefined): number {
  if (typeof raw !== "string") return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * Given the persisted count (sessions seen BEFORE this open), return the
 * 1-based session number for the CURRENT open. The caller persists this
 * value back to storage. Caps the stored value so it can't overflow on a
 * heavy user (anything past the threshold reads the same "no tooltip").
 */
export function nextSessionNumber(persisted: number): number {
  const base = Number.isFinite(persisted) && persisted > 0 ? persisted : 0;
  // Cap so we never store an ever-growing integer; once past the window the
  // exact value is irrelevant (all > MAX → no tooltip).
  return Math.min(base + 1, MAX_TOOLTIP_SESSION + 1);
}

/** Serialize a session number for persistence. */
export function serializeSessionCount(n: number): string {
  return String(Math.max(0, Math.trunc(n)));
}
