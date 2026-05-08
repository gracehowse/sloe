/**
 * F-138 Phase 2 — server-side plausibility gate for barcode-correction
 * submissions. Pure deterministic function; called from
 * `submitFoodCorrection` BEFORE the DB write so junk submissions never
 * reach the user_foods table.
 *
 * Rules from `nutrition-engine` agent (2026-05-08):
 *   `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`
 *
 * Tiered verdicts:
 *   - "block"        → return error to user, "looks off — please check"
 *   - "warn"         → submission accepted but stays `pending`
 *   - "pass"         → all checks pass, ready for verification
 *   - "auto_verify"  → matches an existing verified row within tolerance
 *                      (consensus signal — caller promotes BOTH this and
 *                      the matching peer to `verified`)
 *
 * Trust score / submitter reputation belongs in the CALLER, not this
 * function. Keep this pure + deterministic so it tests cleanly.
 */

export type PlausibilityVerdict = "block" | "warn" | "pass" | "auto_verify";

export type FoodCorrectionSubmission = {
  /** Per 100g — the route normalises perServing → per100g before
   *  calling this function. */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number | null;
  sugar?: number | null;
  satFat?: number | null;
  sodium?: number | null;
};

/** Existing verified canonical row for the same barcode, if any.
 *  Used for cross-submission consensus check. */
export type ExistingVerifiedRow = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium?: number | null;
};

/** Open Food Facts baseline values for the same barcode, if available.
 *  Used to catch unit errors (kcal/serving entered into kcal/100g). */
export type OffBaseline = {
  calories: number;
};

export type PlausibilityResult = {
  verdict: PlausibilityVerdict;
  /** Human-readable reasons, one per failed/warned check. */
  reasons: string[];
};

const BLOCK_RANK = 3;
const WARN_RANK = 2;
const PASS_RANK = 1;

function rank(verdict: Exclude<PlausibilityVerdict, "auto_verify">): number {
  if (verdict === "block") return BLOCK_RANK;
  if (verdict === "warn") return WARN_RANK;
  return PASS_RANK;
}

function rankToVerdict(r: number): Exclude<PlausibilityVerdict, "auto_verify"> {
  if (r >= BLOCK_RANK) return "block";
  if (r >= WARN_RANK) return "warn";
  return "pass";
}

export function checkSubmissionPlausibility(
  submission: FoodCorrectionSubmission,
  existingVerifiedRow?: ExistingVerifiedRow | null,
  offBaseline?: OffBaseline | null,
): PlausibilityResult {
  const s = {
    calories: submission.calories,
    protein: submission.protein,
    carbs: submission.carbs,
    fat: submission.fat,
    fiber: submission.fiber ?? 0,
    sugar: submission.sugar ?? 0,
    satFat: submission.satFat ?? 0,
    sodium: submission.sodium ?? 0,
  };
  const reasons: string[] = [];
  let verdictRank = PASS_RANK;
  const bump = (next: Exclude<PlausibilityVerdict, "auto_verify">, reason: string) => {
    reasons.push(reason);
    verdictRank = Math.max(verdictRank, rank(next));
  };

  // ─────────────────────────────────────────────────────────────────
  // BLOCK tier — structural impossibilities
  // ─────────────────────────────────────────────────────────────────
  for (const [field, value] of Object.entries(s) as Array<[keyof typeof s, number]>) {
    if (!Number.isFinite(value) || value < 0) {
      bump("block", `${field} is negative or non-finite`);
    }
  }
  if (s.protein + s.carbs + s.fat > 102) {
    bump("block", "macros sum > 100g/100g (physically impossible — check for double-entry)");
  }
  if (s.fat > 100) bump("block", "fat > 100g/100g (impossible — pure fat is ~100g/100g)");
  if (s.protein > 100) bump("block", "protein > 100g/100g (impossible)");
  if (s.carbs > 100) bump("block", "carbs > 100g/100g (impossible)");
  if (s.sugar > s.carbs + 0.5) {
    bump("block", "sugar > carbs (sugar is a subset of carbohydrate by definition)");
  }
  if (s.satFat > s.fat + 0.2) {
    bump("block", "saturated fat > total fat (subset violation; check for label-field swap)");
  }
  if (s.fiber > s.carbs + 0.5) {
    bump(
      "block",
      "fiber > carbs (subset violation; possible EU vs US carb convention — check)",
    );
  }
  if (s.calories > 900) {
    bump("block", "calories > 900 kcal/100g (impossible — pure fat ceiling is ~884)");
  }
  if (s.sodium > 40000) {
    bump("block", "sodium > 40,000 mg/100g (impossible — pure salt is ~38,758)");
  }

  // ─────────────────────────────────────────────────────────────────
  // Atwater consistency
  // ─────────────────────────────────────────────────────────────────
  // FDA convention: fiber contributes 2 kcal/g (not 4).
  // Skip alcohol — `alcohol_g` isn't in the submission schema.
  const atwater = 4 * s.protein + 4 * (s.carbs - s.fiber) + 2 * s.fiber + 9 * s.fat;
  const diff = Math.abs(s.calories - atwater);
  const blockTol = Math.max(50, 0.3 * s.calories);
  const warnTol = Math.max(20, 0.15 * s.calories);
  if (diff > blockTol) {
    bump(
      "block",
      `Atwater off by ${diff.toFixed(0)} kcal (>30%) — protein × 4 + carbs × 4 + fat × 9 should match calories`,
    );
  } else if (diff > warnTol) {
    bump("warn", `Atwater off by ${diff.toFixed(0)} kcal (15-30%)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // OFF baseline cross-check (catches unit errors)
  // ─────────────────────────────────────────────────────────────────
  if (offBaseline?.calories && offBaseline.calories > 0) {
    const ratio = s.calories / offBaseline.calories;
    if (ratio > 3 || ratio < 1 / 3) {
      bump(
        "block",
        `calories ${ratio.toFixed(2)}× OFF baseline (likely unit error — kcal/serving in kcal/100g field?)`,
      );
    } else if (ratio > 1.5 || ratio < 0.67) {
      bump("warn", `calories differ >50% from OFF baseline (possible reformulation)`);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Sodium / low-cal sanity (warns)
  // ─────────────────────────────────────────────────────────────────
  if (s.sodium > 5000) {
    bump("warn", "sodium > 5000 mg/100g — verify (legitimate for soy sauce / bouillon)");
  }
  if (s.sodium > 0 && s.sodium < 1 && s.protein + s.fat + s.carbs > 1) {
    bump("warn", "sodium < 1 mg/100g but macros present — possible g/mg unit error");
  }
  if (s.calories < 1 && s.protein + s.fat + s.carbs > 0.5) {
    bump("warn", "calories near zero but macros present");
  }

  // ─────────────────────────────────────────────────────────────────
  // Cross-submission consensus (drives AUTO_VERIFY)
  // ─────────────────────────────────────────────────────────────────
  let consensus = false;
  if (existingVerifiedRow) {
    const within = (a: number, b: number, pct: number, abs: number) =>
      Math.abs(a - b) <= Math.max(abs, pct * Math.max(a, b));
    consensus =
      within(s.calories, existingVerifiedRow.calories, 0.1, 5) &&
      within(s.protein, existingVerifiedRow.protein, 0.15, 1) &&
      within(s.carbs, existingVerifiedRow.carbs, 0.15, 1) &&
      within(s.fat, existingVerifiedRow.fat, 0.15, 1) &&
      within(s.sodium, existingVerifiedRow.sodium ?? 0, 0.2, 50);
    if (!consensus) {
      bump(
        "warn",
        "differs from existing verified row — possible reformulation (route to admin, do not silently overwrite)",
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Final verdict
  // ─────────────────────────────────────────────────────────────────
  const baseVerdict = rankToVerdict(verdictRank);
  if (baseVerdict === "pass" && consensus) {
    return { verdict: "auto_verify", reasons: [] };
  }
  return { verdict: baseVerdict, reasons };
}
