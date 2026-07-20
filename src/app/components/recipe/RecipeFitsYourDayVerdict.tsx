"use client";

import { Check } from "lucide-react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import type { FitsYourDayVerdict } from "../../../lib/recipe/recipeDetailLayout.ts";

/**
 * Recipe-detail "Fits your day" verdict. Extracted out of the
 * `RecipeDetail.tsx` monolith (ENG-1612) so the new chip treatment doesn't
 * push that file past its `check:screen-budget` pin — mirrors mobile, where
 * this verdict already lives in the separately-extracted
 * `apps/mobile/components/recipe/RecipeTitleBlock.tsx`.
 *
 * History: ENG-1085 (2026-06-13) shipped a confident full-width SOLID
 * banner — the differentiator needed presence. Grace flagged it as "too big
 * and agressive" (2026-07-19, annotated screenshot of Soothing Chicken
 * Congee). ENG-1612 supersedes that carve-out: prototype canon
 * (`docs/ux/redesign/v3/Sloe-App.html` `.rd-fits`, ~L2055) is an inline soft
 * pill, not a full-width slab — same scale as the card-level `.fit-tag`.
 *
 * Ships behind `recipe_verdict_chip_v1` (default-OFF — see
 * `docs/decisions/2026-07-19-fits-your-day-verdict-chip.md`): flag-on
 * renders the soft chip, flag-off keeps the ENG-1085 solid banner as the
 * kill switch. Tri-state semantics + the ≈% figure are unchanged — both
 * branches render the same shared `computeFitsYourDayVerdict` output
 * (`RecipeDetail.tsx` computes it and passes it in), only the presentation
 * differs.
 */
export function RecipeFitsYourDayVerdict({
  verdict,
}: {
  verdict: FitsYourDayVerdict | null;
}) {
  if (!verdict) return null;

  const verdictChipV1 = isFeatureEnabled("recipe_verdict_chip_v1");

  if (verdictChipV1) {
    // ENG-1612 — prototype-scale inline soft pill (`.rd-fits`): 11px
    // semibold, `*-soft` tone tint, 4/12 padding (px-3 py-1 — both on the
    // spacing scale), radius full. Tone pair: `*-soft` bg + AA-safe text —
    // `warning-solid` (not the 2.96:1 plain `warning`) carries the amber
    // tone's text, matching the `icon-box` tone-class map.
    const verdictChipClass =
      verdict.tone === "success"
        ? "bg-success-soft text-success"
        : verdict.tone === "warning"
          ? "bg-warning-soft text-warning-solid"
          : "bg-destructive-soft text-destructive";
    return (
      <div
        data-testid="recipe-fits-your-day"
        role="status"
        aria-label={verdict.a11y}
        className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${verdictChipClass}`}
      >
        {verdict.fits ? <Check className="w-[13px] h-[13px]" strokeWidth={3} aria-hidden /> : null}
        <span>{verdict.label}</span>
      </div>
    );
  }

  // ENG-1085 — confident SOLID verdict banner (white on a scheme-constant
  // dark tone, AA-safe in both schemes; mirrors mobile RecipeTitleBlock).
  // Flag-off kill switch for ENG-1612.
  const [verdictHead, ...verdictRest] = verdict.label.split(" · ");
  const verdictTail = verdictRest.join(" · ");
  const verdictBannerBg =
    verdict.tone === "success"
      ? "var(--verdict-banner-success)"
      : verdict.tone === "warning"
        ? "var(--verdict-banner-warning)"
        : "var(--verdict-banner-destructive)";
  return (
    <div
      data-testid="recipe-fits-your-day"
      role="status"
      aria-label={verdict.a11y}
      className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-white animate-in fade-in zoom-in-95 duration-300"
      style={{ backgroundColor: verdictBannerBg }}
    >
      {verdict.fits ? <Check className="w-[18px] h-[18px]" strokeWidth={3} aria-hidden /> : null}
      <span className="text-[15px] font-bold">{verdictHead}</span>
      {verdictTail ? (
        <span className="ml-auto text-[13px] font-medium text-white/80">{verdictTail}</span>
      ) : null}
    </div>
  );
}

export default RecipeFitsYourDayVerdict;
