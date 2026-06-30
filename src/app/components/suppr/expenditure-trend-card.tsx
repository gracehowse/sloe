"use client";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import {
  buildExpenditureTrendCopy,
  type ExpenditureTrendInput,
} from "../../../lib/progress/expenditureTrend.ts";
import { SupprCard } from "../ui/suppr-card.tsx";
import { IconBox } from "../ui/icon-box.tsx";
import { Icons } from "../ui/icons.ts";
import { ConfidenceChip } from "../ui/confidence-chip.tsx";

/**
 * ENG-953 — calm "Expenditure" trend card (web). Sits under the Maintenance
 * card on Progress. Reuses the adaptive / measured TDEE ALREADY in
 * `ProgressDashboard` state (`adaptive_tdee` / `adaptive_tdee_confidence` /
 * `adaptive_tdee_updated_at` + `measured_tdee`) — recomputes nothing. All copy
 * comes from the shared `buildExpenditureTrendCopy` helper so web and mobile
 * can never drift.
 *
 * Gated behind `expenditure_trend_card` (default-OFF). Renders nothing when the
 * flag is off — flag-off ships ZERO visual change, and the existing collapsed
 * "How this works" expandable under the Maintenance card stays the live path.
 *
 * Body-neutral, soft-confidence: "burning about ~X kcal/day lately" when we
 * have a confident read, "still learning your pattern" otherwise. Never a
 * false-precision integer (the figure is rounded to the nearest 10 in the
 * helper). Parity: mobile `ExpenditureTrendCard` renders the identical copy
 * behind the same flag.
 */
export function ExpenditureTrendCard(props: ExpenditureTrendInput) {
  if (!isFeatureEnabled("expenditure_trend_card")) return null;

  const copy = buildExpenditureTrendCopy(props);

  return (
    <SupprCard
      elevation="card"
      padding="lg"
      radius="lg"
      className="mb-6"
      data-testid="progress-expenditure-trend-card"
      data-source={copy.source}
    >
      <div className="flex items-center gap-2 mb-3">
        <IconBox size="sm" tone="primary">
          <Icons.activity />
        </IconBox>
        <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground-brand">
          Expenditure
        </p>
        {copy.chipLevel && (
          <ConfidenceChip level={copy.chipLevel} className="ml-auto" />
        )}
      </div>

      <p
        className="text-[15px] leading-relaxed text-foreground"
        data-testid="progress-expenditure-trend-line"
      >
        {copy.line}
      </p>

      {copy.detail ? (
        <p
          className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
          data-testid="progress-expenditure-trend-detail"
        >
          {copy.detail}
        </p>
      ) : null}
    </SupprCard>
  );
}

export default ExpenditureTrendCard;
