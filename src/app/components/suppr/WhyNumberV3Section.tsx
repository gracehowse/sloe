"use client";

import { Activity, Sparkles, TrendingDown } from "lucide-react";

import { IconBox } from "../ui/icon-box";
import { SupprButton } from "./suppr-button";
import {
  WHY_NUMBER_V3_COPY,
  buildWhyNumberResultSubtitle,
  formatWhyNumberHeroKcal,
  whyNumberCoachQuote,
  whyNumberConfidenceCard,
  whyNumberV3Rows,
} from "@/lib/whyNumberV3";
import type { WhyThisNumberResult } from "@/lib/nutrition/whyThisNumber";

export interface WhyNumberV3SectionProps {
  targetCalories: number;
  result: WhyThisNumberResult;
  confidence: "low" | "medium" | "high" | null;
  loggingDays?: number | null;
  onKeepTarget?: () => void;
  onAdjustTarget?: () => void;
}

export function WhyNumberV3Section({
  targetCalories,
  result,
  confidence,
  loggingDays,
  onKeepTarget,
  onAdjustTarget,
}: WhyNumberV3SectionProps) {
  const rows = whyNumberV3Rows(result);
  const confidenceCard = whyNumberConfidenceCard(confidence, loggingDays);

  return (
    <div className="flex flex-col gap-4" data-testid="why-number-v3-section">
      <div className="flex flex-col items-center gap-1 py-2 text-center">
        <p className="section-label text-muted-foreground">{WHY_NUMBER_V3_COPY.heroOverline}</p>
        <p
          className="font-[family-name:var(--font-headline)] text-[40px] font-medium tabular-nums leading-none tracking-tight text-foreground"
          data-testid="why-number-hero-kcal"
        >
          {formatWhyNumberHeroKcal(targetCalories)}
        </p>
        <p className="section-label text-muted-foreground tracking-wide">{WHY_NUMBER_V3_COPY.kcalPerDay}</p>
      </div>

      <p className="text-center text-sm leading-relaxed text-muted-foreground italic px-2">
        {whyNumberCoachQuote(result.summary)}
      </p>

      <p className="section-label px-1">{WHY_NUMBER_V3_COPY.sectionOverline}</p>
      <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
        {rows.map((row) => {
          const Icon = row.key === "tdee" ? Sparkles : TrendingDown;
          return (
            <div
              key={row.key}
              data-testid={`why-number-v3-row-${row.key}`}
              className={`flex items-center gap-3 px-4 py-3 ${row.highlight ? "bg-primary/5" : ""}`}
            >
              <IconBox
                size="md"
                tone={row.highlight ? "primary" : "muted"}
                className="rounded-lg"
              >
                <Icon className="size-4" aria-hidden />
              </IconBox>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.subtitle}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{row.value}</span>
            </div>
          );
        })}
      </div>

      <div
        className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-4 text-primary-foreground shadow-md"
        data-testid="why-number-result-card"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{WHY_NUMBER_V3_COPY.yourTarget}</p>
          <p className="text-xs opacity-80">{buildWhyNumberResultSubtitle(result.lines)}</p>
        </div>
        <span className="font-[family-name:var(--font-headline)] text-4xl font-medium tabular-nums leading-none">
          {formatWhyNumberHeroKcal(targetCalories)}
        </span>
      </div>

      {confidenceCard ? (
        <div className="flex gap-3 rounded-xl border border-border bg-card p-4">
          <IconBox size="md" tone="success" className="rounded-lg shrink-0">
            <Activity className="size-4" aria-hidden />
          </IconBox>
          <div>
            <p className="text-sm font-semibold text-foreground">{confidenceCard.title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{confidenceCard.body}</p>
          </div>
        </div>
      ) : null}

      {onKeepTarget ? (
        <SupprButton
          variant="primary"
          className="w-full"
          data-testid="why-number-keep-target"
          onClick={onKeepTarget}
        >
          {WHY_NUMBER_V3_COPY.keepThisTarget}
        </SupprButton>
      ) : null}
      {onAdjustTarget ? (
        <SupprButton
          variant="ghost"
          className="w-full"
          data-testid="why-this-number-adjust-target"
          onClick={onAdjustTarget}
        >
          {WHY_NUMBER_V3_COPY.adjustPace}
        </SupprButton>
      ) : null}
    </div>
  );
}
