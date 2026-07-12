/**
 * energyNumbers — ENG-1506 canonical energy-number layer.
 *
 * The 2026-07-11 energy audit found four "maintenance" values live at once
 * (1,567 / 1,647 / 1,720 / 1,778) for the same account in the same hour.
 * The shared `resolveMaintenance` ALGORITHM was never the problem — its
 * gates (medium/high confidence, 14-day staleness, ENG-1057/ENG-1111
 * below-sedentary-formula floors, "never fabricate" null contract) are the
 * most-correct computation in the repo. The divergence came from
 * (a) un-normalised INPUTS — web Progress fed the stale `profiles.weight_kg`
 *     snapshot while mobile Progress fed the latest weigh-in, and because
 *     `formulaKcal` is both the fallback AND the ENG-1057/1111 floor, a
 *     weight skew can FLIP which branch wins — and
 * (b) three surfaces that BYPASSED the resolver entirely (Targets raw
 *     adaptive, Expenditure raw measured with a hard-coded "high" chip,
 *     the adaptive-tdee API without the staleness gate).
 *
 * This module is the thin canonical input + qualifier layer in front of the
 * blessed resolver. Decision doc:
 * `docs/decisions/2026-07-11-canonical-energy-numbers.md`.
 *
 * Input policy (decided once, here, for every surface):
 *   - weight_kg = latest `weight_kg_by_day` entry, falling back to the
 *     `profiles.weight_kg` snapshot (the by-day map is fresher — Health
 *     sync writes it first and the profile column lags; see
 *     `resolveLatestWeightKg`'s doc in `src/lib/weightProjection.ts`).
 *   - sex / height_cm / age strict-parse to null when missing — NO
 *     `?? 70` / `|| 170` / `|| 30` / `"unspecified"` fabrication. The
 *     resolver's "never fabricate a maintenance number" contract only
 *     holds if the inputs honour it too.
 *   - adaptive_* / measured_* columns pass through verbatim (strict-typed).
 *
 * Pure functions; no React, no platform APIs. Mobile imports via
 * `@suppr/nutrition-core/energyNumbers` (mirror in `src/lib/nutrition-core`).
 *
 * Rollout: consumers gate the switch to `selectMaintenance` behind the
 * `energy_numbers_v1` flag (default-OFF; PostHog-ramped) with their legacy
 * input assembly alive in the else branch.
 */

import { resolveLatestWeightKg } from "../weightProjection";
import {
  resolveMaintenance,
  type MaintenanceConfidence,
  type MaintenanceProfile,
  type MaintenanceSource,
  type ResolvedMaintenance,
} from "./resolveMaintenance";
import type { ActivityLevel, Sex } from "./tdee";
import {
  recencyPhrase,
  roundExpenditureToTen,
  type ExpenditureTrendCopy,
} from "../progress/expenditureTrend";
import { formatKcalDisplay } from "./formatMacro";

/** The rollout flag. Default-OFF (registered in `KNOWN_DEFAULT_OFF_FLAGS`
 *  on both platforms); Grace ramps via PostHog after sim + web validation. */
export const ENERGY_NUMBERS_V1_FLAG = "energy_numbers_v1";

/**
 * The raw `profiles` columns the input policy reads. Every field is
 * `unknown`-tolerant so a raw Supabase row (which can carry strings /
 * malformed JSONB) can be passed straight in — the builder owns ALL
 * parsing so no screen re-derives it.
 */
export interface EnergyProfileRow {
  adaptive_tdee?: unknown;
  adaptive_tdee_confidence?: unknown;
  adaptive_tdee_updated_at?: unknown;
  measured_tdee?: unknown;
  measured_tdee_confidence?: unknown;
  measured_tdee_updated_at?: unknown;
  sex?: unknown;
  weight_kg?: unknown;
  height_cm?: unknown;
  age?: unknown;
  activity_level?: unknown;
  weight_kg_by_day?: unknown;
}

function finitePositive(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : raw == null || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stringOrNull(raw: unknown): string | null {
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

/** Defensive parse of the `weight_kg_by_day` JSONB map — non-finite and
 *  non-positive entries dropped, everything else keyed as-is. */
export function parseWeightKgByDayMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = n;
    }
  }
  return out;
}

const SEX_VALUES: readonly string[] = ["male", "female", "unspecified"];
const ACTIVITY_VALUES: readonly string[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];

/**
 * THE input policy. Builds the `MaintenanceProfile` every surface feeds to
 * `resolveMaintenance` — latest weigh-in wins over the profile snapshot,
 * strict-null body basics, verbatim adaptive/measured columns.
 */
export function buildMaintenanceInputs(row: EnergyProfileRow): MaintenanceProfile {
  const sexRaw =
    typeof row.sex === "string" ? row.sex.trim().toLowerCase() : "";
  const actRaw =
    typeof row.activity_level === "string"
      ? row.activity_level.trim().toLowerCase()
      : "";
  return {
    adaptive_tdee: finitePositive(row.adaptive_tdee),
    adaptive_tdee_confidence: stringOrNull(row.adaptive_tdee_confidence),
    adaptive_tdee_updated_at: stringOrNull(row.adaptive_tdee_updated_at),
    measured_tdee: finitePositive(row.measured_tdee),
    measured_tdee_confidence: stringOrNull(row.measured_tdee_confidence),
    measured_tdee_updated_at: stringOrNull(row.measured_tdee_updated_at),
    sex: SEX_VALUES.includes(sexRaw) ? (sexRaw as Sex) : null,
    // Latest weigh-in beats the (lagging) profile snapshot; null when
    // neither exists — the resolver then returns null rather than a
    // fabricated 70 kg maintenance.
    weight_kg: resolveLatestWeightKg(
      parseWeightKgByDayMap(row.weight_kg_by_day),
      finitePositive(row.weight_kg),
    ),
    height_cm: finitePositive(row.height_cm),
    age: finitePositive(row.age),
    // Carried for call-site compatibility only — the resolver's formula
    // seed is pinned to sedentary and never consults this.
    activity_level: ACTIVITY_VALUES.includes(actRaw)
      ? (actRaw as ActivityLevel)
      : null,
  };
}

/**
 * The ONE call every screen makes: canonical inputs → blessed resolver.
 * Two surfaces given the same profile row can no longer print two numbers.
 */
export function selectMaintenance(
  row: EnergyProfileRow,
  opts: { now?: Date; enableMeasured?: boolean } = {},
): ResolvedMaintenance | null {
  return resolveMaintenance(buildMaintenanceInputs(row), opts);
}

/** The explicit qualifier that ships beside every rendered maintenance
 *  numeral — one grammar across Today / Progress / Targets. */
export interface MaintenanceQualifier {
  /** Source pill text (existing Progress pill vocabulary). */
  pill: "Apple Health" | "Adaptive" | "Formula estimate";
  /** One-line caption under / beside the kcal numeral. */
  line: string;
}

/** THE canonical formula-source qualifier string (ENG-1506 review round):
 *  `maintenanceQualifier` AND the Why-this-number TDEE row both import it,
 *  so a formula-resolved maintenance can never render two different
 *  provenance claims one tap apart. One string — never fork it. */
export const MAINTENANCE_FORMULA_QUALIFIER_LINE =
  "Formula estimate from your stats";

export function maintenanceQualifier(
  source: MaintenanceSource,
  confidence: MaintenanceConfidence,
): MaintenanceQualifier {
  if (source === "measured") {
    return {
      pill: "Apple Health",
      line: `Apple Health · ${confidence ?? "medium"} confidence`,
    };
  }
  if (source === "adaptive") {
    return {
      pill: "Adaptive",
      line: `From your logs · ${confidence ?? "medium"} confidence`,
    };
  }
  return { pill: "Formula estimate", line: MAINTENANCE_FORMULA_QUALIFIER_LINE };
}

/**
 * The Expenditure card's canonical data path (flag-ON): phrase the copy
 * from the SAME resolved maintenance the sibling Maintenance card shows.
 * Structurally impossible to assert a kcal the resolver rejected —
 * measured copy renders ONLY when the resolver selected measured, the
 * chip is the REAL resolved confidence (kills the hard-coded "high"),
 * and formula/null falls to the honest "still learning" state.
 *
 * Legacy (flag-OFF) path stays `buildExpenditureTrendCopy` in
 * `src/lib/progress/expenditureTrend.ts` until the flag collapses.
 */
export function expenditureFromResolved(
  resolved: ResolvedMaintenance | null,
  adaptiveUpdatedAt: string | null,
  opts: { now?: number } = {},
): ExpenditureTrendCopy {
  const now = opts.now ?? Date.now();
  if (resolved?.source === "measured") {
    const rounded = roundExpenditureToTen(resolved.kcal);
    return {
      line: `Your body's been using about ~${formatKcalDisplay(rounded)} kcal/day lately, going by your Apple Health activity.`,
      detail: "Observed from your device — it'll keep adjusting as you move.",
      chipLevel: resolved.confidence ?? null,
      source: "measured",
      roundedKcal: rounded,
    };
  }
  if (resolved?.source === "adaptive") {
    const rounded = roundExpenditureToTen(resolved.kcal);
    return {
      line: `You've been burning about ~${formatKcalDisplay(rounded)} kcal/day lately.`,
      detail: recencyPhrase(adaptiveUpdatedAt, now),
      chipLevel: resolved.confidence ?? null,
      source: "adaptive",
      roundedKcal: rounded,
    };
  }
  // Formula fallback or no resolution at all — no number, no false chip.
  return {
    line: "We're still learning your expenditure pattern.",
    detail:
      "Keep logging meals and weighing in, and a personalised daily burn will settle in here.",
    chipLevel:
      resolved?.source === "formula" && resolved.confidence === "low"
        ? "low"
        : null,
    source: "none",
    roundedKcal: null,
  };
}
