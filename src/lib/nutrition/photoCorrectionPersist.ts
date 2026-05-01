/**
 * photoCorrectionPersist — orchestrates the "corrections persist into
 * the user's personal food bank" loop on top of the photo-log review
 * UI. Cross-platform helper imported by both web (`PhotoLogDialog`)
 * and mobile (`PhotoLogSheet`).
 *
 * Why a separate module:
 *  - The detection rule (`isMeaningfulPhotoCorrection`), the upsert
 *    rule (`upsertCustomFoodFromPhotoCorrection`), and the analytics
 *    emit need to fire as one unit; both surfaces would otherwise
 *    re-implement the loop and silently drift.
 *  - Both platforms call this once per commit, fire-and-forget — the
 *    photo-log meals still log to the journal even if the bank
 *    upsert fails (network down, RLS hiccup). The user's logged
 *    nutrition is never blocked by the persistence side-effect.
 *
 * Behaviour:
 *  - For each (original, corrected) pair, decide whether the user
 *    meaningfully edited (name change OR macro delta over rounding
 *    noise). Skip non-edits.
 *  - Upsert each meaningful correction. Skip silently when the user
 *    already has a `manual` row with the same name (their hand-
 *    curated entry stays canonical).
 *  - Emit `photo_log_correction_persisted` per outcome so the funnel
 *    can read insert vs update vs skipped_manual.
 *
 * Returns a count of insert / update / skipped / error so callers
 * can render a one-time confirmation toast on the first persisted
 * correction (the spec's "Got it — we'll remember this for next
 * time" UI).
 */

import { isMeaningfulPhotoCorrection, type AiLoggedItem } from "./aiLogging";
import {
  upsertCustomFoodFromPhotoCorrection,
  type PhotoCorrectionMacros,
} from "./customFoodsClient";

/** Supabase-js-compatible. Same shape used elsewhere in this module
 *  family — typed loose so the helper runs in Node tests, web, and
 *  React Native without pulling in workspace-specific types. */
export type SupabaseLike = {
  from: (table: string) => any;
};

/** Tracker stub matching the shape of `track(event, payload)` on both
 *  platforms. We accept the function rather than importing `track`
 *  directly so this module stays free of platform analytics shims. */
export type TrackFn = (event: string, payload?: Record<string, unknown>) => void;

/** Outcome of a single (original, corrected) pair. */
export type PhotoCorrectionOutcome =
  | { kind: "insert"; foodName: string }
  | { kind: "update"; foodName: string }
  | { kind: "skipped_no_change"; foodName: string }
  | { kind: "skipped_manual"; foodName: string }
  | { kind: "error"; foodName: string; reason: string };

/** Aggregate counts so the UI can render a single confirmation. */
export type PhotoCorrectionsResult = {
  outcomes: PhotoCorrectionOutcome[];
  /** Count of rows newly inserted into the bank. */
  inserted: number;
  /** Count of pre-existing photo_correction rows updated. */
  updated: number;
  /** Count of items where the macros / name didn't change. */
  skippedNoChange: number;
  /** Count of items where a manual row blocks the overwrite. */
  skippedManual: number;
  /** Count of items where the upsert threw. */
  errored: number;
  /** True iff at least one row was inserted OR updated — drives the
   *  "Got it — we'll remember this for next time" toast. */
  anyPersisted: boolean;
};

const PHOTO_CORRECTION_PERSISTED_EVENT = "photo_log_correction_persisted";

/**
 * Persist meaningful photo-log corrections to the user's bank.
 * Fire-and-forget — never throws; errors are captured per-outcome so
 * the caller can read them but a thrown call would block the meal
 * commit and that's not acceptable. The Promise resolves once every
 * upsert has settled.
 *
 * `originals` and `corrected` MUST be the same length. The helper
 * resolves to a count-shape result and an outcomes array so the UI
 * can show a one-time toast on the first persistence.
 */
export async function persistPhotoCorrections(opts: {
  supabase: SupabaseLike;
  userId: string;
  originals: readonly AiLoggedItem[];
  corrected: readonly AiLoggedItem[];
  track?: TrackFn;
}): Promise<PhotoCorrectionsResult> {
  const { supabase, userId, originals, corrected, track } = opts;

  const result: PhotoCorrectionsResult = {
    outcomes: [],
    inserted: 0,
    updated: 0,
    skippedNoChange: 0,
    skippedManual: 0,
    errored: 0,
    anyPersisted: false,
  };

  if (!userId || !supabase) {
    // No auth or no client — nothing to persist; treat every item as
    // a no-change skip so the caller's analytics stay symmetric.
    for (const item of corrected) {
      result.outcomes.push({ kind: "skipped_no_change", foodName: item?.name ?? "" });
      result.skippedNoChange += 1;
    }
    return result;
  }

  if (originals.length !== corrected.length) {
    throw new Error(
      "persistPhotoCorrections: originals and corrected lengths must match",
    );
  }

  for (let i = 0; i < corrected.length; i++) {
    const orig = originals[i]!;
    const next = corrected[i]!;
    const foodName = String(next?.name ?? "").trim();
    if (!foodName) {
      result.outcomes.push({ kind: "skipped_no_change", foodName });
      result.skippedNoChange += 1;
      continue;
    }
    if (!isMeaningfulPhotoCorrection(orig, next)) {
      result.outcomes.push({ kind: "skipped_no_change", foodName });
      result.skippedNoChange += 1;
      continue;
    }

    const macros: PhotoCorrectionMacros = {
      calories: Number.isFinite(next.calories) ? next.calories : 0,
      protein: Number.isFinite(next.protein) ? next.protein : 0,
      carbs: Number.isFinite(next.carbs) ? next.carbs : 0,
      fat: Number.isFinite(next.fat) ? next.fat : 0,
    };
    if (next.fiber != null && Number.isFinite(next.fiber)) {
      macros.fiber = next.fiber;
    }

    let pre: { existed: boolean; source: string | null } = { existed: false, source: null };
    try {
      // Cheap read so we can label the outcome insert vs update for
      // analytics. The upsert helper does its own read+write
      // anyway, but we duplicate this lightweight peek so the event
      // payload reads correctly even when the helper short-circuits
      // on a manual row.
      const { data } = await supabase
        .from("user_custom_foods")
        .select("id, source")
        .eq("user_id", userId)
        .ilike("name", foodName);
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (row) pre = { existed: true, source: String(row.source ?? "manual") };
    } catch {
      /* read flaky — fall through and let the upsert dictate the outcome */
    }

    try {
      const upserted = await upsertCustomFoodFromPhotoCorrection(
        supabase,
        userId,
        foodName,
        macros,
      );
      if (upserted == null) {
        // Helper short-circuited on a manual row.
        result.outcomes.push({ kind: "skipped_manual", foodName });
        result.skippedManual += 1;
        track?.(PHOTO_CORRECTION_PERSISTED_EVENT, {
          foodName,
          kind: "skipped_manual",
        });
        continue;
      }
      const kind: "insert" | "update" = pre.existed ? "update" : "insert";
      if (kind === "insert") {
        result.inserted += 1;
      } else {
        result.updated += 1;
      }
      result.outcomes.push({ kind, foodName });
      track?.(PHOTO_CORRECTION_PERSISTED_EVENT, { foodName, kind });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      result.errored += 1;
      result.outcomes.push({ kind: "error", foodName, reason });
    }
  }

  result.anyPersisted = result.inserted > 0 || result.updated > 0;
  return result;
}
