/**
 * T13 (full-sweep 2026-04-24) — weight surface mode helper.
 *
 * Decides how a weight delta renders across Digest, Progress, and the
 * weight chart given the user's `profiles.weight_surface_mode` setting.
 * Shared between web + mobile so the two platforms can't drift on ED /
 * dysphoria-sensitive UI.
 *
 * Policy: `docs/decisions/2026-04-24-phase2-architecture-choices.md` §T13.
 */

import { describeTrendOnly } from "../preferences/trendOnlyWeight";

export type WeightSurfaceMode = "show" | "hide" | "trends_only";

const VALID: ReadonlySet<WeightSurfaceMode> = new Set(["show", "hide", "trends_only"] as const);

/**
 * Normalise whatever the DB / profile object hands us into a valid
 * `WeightSurfaceMode`. Any unknown / null / missing value defaults to
 * `"show"` so the current experience is preserved for legacy rows.
 */
export function coerceWeightSurfaceMode(raw: unknown): WeightSurfaceMode {
  if (typeof raw === "string" && VALID.has(raw as WeightSurfaceMode)) {
    return raw as WeightSurfaceMode;
  }
  return "show";
}

/**
 * Trend direction keys used by `trends_only`. `null` when the delta is
 * missing (`null`) — renderers should suppress the trend row entirely
 * rather than claiming "stable".
 */
export type WeightTrendDirection = "up" | "down" | "stable";

/** Grams threshold for "stable" — below this in absolute terms we
 *  describe the week as stable rather than up/down. Matches the Digest
 *  headline threshold of 0.3 kg in `digest.ts` so the two primitives
 *  can't disagree.
 */
export const WEIGHT_TRENDS_STABLE_KG = 0.3;

export function weightTrendDirection(deltaKg: number | null | undefined): WeightTrendDirection | null {
  if (deltaKg == null || !Number.isFinite(deltaKg)) return null;
  if (Math.abs(deltaKg) < WEIGHT_TRENDS_STABLE_KG) return "stable";
  return deltaKg < 0 ? "down" : "up";
}

/**
 * Result shape for a weight surface render decision. Consumers read
 * `kind` and render accordingly. Never hand back absolute kg when
 * `kind !== "show"` — that's the whole point of the opt-out.
 */
export type WeightSurfaceDecision =
  | { kind: "hidden" }
  | { kind: "trends"; direction: WeightTrendDirection | null; label: string }
  | { kind: "show"; deltaKg: number | null; deltaText: string | null };

export function decideWeightSurface(
  mode: WeightSurfaceMode,
  deltaKg: number | null | undefined,
): WeightSurfaceDecision {
  if (mode === "hide") return { kind: "hidden" };

  if (mode === "trends_only") {
    const direction = weightTrendDirection(deltaKg);
    // ENG-713 — route the Digest/Recap weight tile through the SAME shared
    // body-neutral helper as the Progress trend-only card so both opt-out paths
    // speak one reviewed language (DI + legal sign-off 2026-07-01). "stable" is
    // the T13 direction name; the shared helper's neutral word for it is "steady".
    const label = describeTrendOnly(direction === "stable" ? "steady" : direction);
    return { kind: "trends", direction, label };
  }

  // mode === "show"
  const delta = deltaKg ?? null;
  const deltaText =
    delta != null && Number.isFinite(delta)
      ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`
      : null;
  return { kind: "show", deltaKg: delta, deltaText };
}

/**
 * Body-neutral label for when the Digest Weight tile is hidden — we
 * swap to "Logging consistency" as the replacement stat (per the T13
 * decision). Keeps the 2×2 grid shape without leaking weight data.
 */
export const DIGEST_HIDDEN_WEIGHT_REPLACEMENT_LABEL = "Logging";
export const DIGEST_HIDDEN_WEIGHT_REPLACEMENT_HINT = "days logged this week";

/**
 * Pure formatter for the replacement stat value. `daysLogged` is
 * expected to be 0–7 on a weekly Digest; we clamp defensively.
 */
export function formatLoggingConsistencyValue(daysLogged: number): string {
  const n = Number.isFinite(daysLogged) ? Math.max(0, Math.min(7, Math.round(daysLogged))) : 0;
  return `${n}/7`;
}
