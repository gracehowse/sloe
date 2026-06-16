import type { PersonalisedPlanPaywallSummary } from "../../src/lib/paywall/personalisedPlanSummary.ts";
import { PAYWALL_PERSONALISED_PLAN_TEST_ID } from "../../src/lib/paywall/personalisedPlanSummary.ts";

/**
 * ENG-966 — web parity for the onboarding-derived plan recap card.
 */
export function PricingPersonalisedPlanCard({
  summary,
}: {
  summary: PersonalisedPlanPaywallSummary;
}) {
  return (
    <div
      data-testid={PAYWALL_PERSONALISED_PLAN_TEST_ID}
      className="mb-8 rounded-2xl border border-border bg-card p-6"
      role="region"
      aria-label={`${summary.heroTitle}. ${summary.calories} calories per day${summary.goalLabel ? `, ${summary.goalLabel}` : ""}.`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent-primary-solid)]">
        {summary.eyebrow}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-medium font-[family-name:var(--font-newsreader)] tracking-tight text-foreground-brand tabular-nums">
          {summary.calories.toLocaleString()}
        </span>
        <span className="text-sm text-muted-foreground">{summary.caloriesLabel}</span>
      </div>
      {summary.goalLabel ? (
        <p className="mt-1 text-sm font-medium text-muted-foreground">{summary.goalLabel}</p>
      ) : null}
      {summary.proteinG != null ? (
        <p className="mt-1 text-sm font-medium text-[var(--macro-protein)]">
          {summary.proteinG}g protein / day
        </p>
      ) : null}
    </div>
  );
}
