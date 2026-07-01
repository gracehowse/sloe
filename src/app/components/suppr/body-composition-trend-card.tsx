"use client";

import { useRouter } from "next/navigation";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import {
  buildBodyCompositionTrendCopy,
  type BodyCompositionTrendInput,
} from "../../../lib/progress/bodyCompositionTrends.ts";
import type { UserTier } from "../../../lib/supabase/serverAnonClient.ts";
import { SupprButton } from "./suppr-button.tsx";
import { SupprCard } from "../ui/suppr-card.tsx";
import { IconBox } from "../ui/icon-box.tsx";
import { Icons } from "../ui/icons.ts";
import { Badge } from "./badge.tsx";

export type BodyCompositionTrendCardProps = BodyCompositionTrendInput & {
  userTier: UserTier;
};

/**
 * ENG-1237 — Body-composition trends card on Progress (web). Pro users see body
 * fat % + derived lean-mass kg with a 90-day delta; Free/Base users see a
 * factual Pro upsell (no numbers). Gated behind `body_composition_trends_v1`
 * (default-ON per ENG-1279). Parity: mobile `BodyCompositionTrendCard`.
 */
export function BodyCompositionTrendCard({
  userTier,
  ...input
}: BodyCompositionTrendCardProps) {
  const router = useRouter();
  if (!isFeatureEnabled("body_composition_trends_v1")) return null;

  const isPro = userTier === "pro";
  const copy = isPro ? buildBodyCompositionTrendCopy(input) : null;

  return (
    <SupprCard
      elevation="card"
      padding="lg"
      radius="lg"
      className="mb-6"
      data-testid="progress-body-composition-card"
      data-locked={!isPro ? "true" : "false"}
    >
      <div className="flex items-center gap-2 mb-4">
        <IconBox size="sm" tone="primary">
          <Icons.activity />
        </IconBox>
        <p className="font-[family-name:var(--font-headline)] text-[18px] font-medium text-foreground-brand">
          Body composition
        </p>
        {!isPro ? <Badge variant="pro" className="ml-1">Pro</Badge> : null}
      </div>

      {!isPro ? (
        <>
          <p className="text-[15px] leading-relaxed text-foreground">
            Track body fat and lean mass trends over time — a quiet read on how your composition is shifting.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Included with Sloe Pro alongside adaptive targets and unlimited imports.
          </p>
          <SupprButton
            variant="ghost"
            className="mt-4 w-full"
            onClick={() => router.push("/pricing")}
          >
            See Pro plans
          </SupprButton>
        </>
      ) : copy?.hasReadableData ? (
        <div className="grid grid-cols-2 gap-0 divide-x divide-border">
          <MetricColumn
            label="Body fat"
            value={copy.bodyFat.current}
            unit="%"
            deltaLabel={copy.bodyFat.deltaLabel}
            masked
          />
          <MetricColumn
            label="Lean mass"
            value={copy.leanMass.current}
            unit="kg"
            deltaLabel={copy.leanMass.deltaLabel}
            masked
            className="pl-4"
          />
        </div>
      ) : (
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Log body fat from Apple Health or your scale — we&apos;ll show how it trends alongside your weight.
        </p>
      )}
    </SupprCard>
  );
}

function MetricColumn({
  label,
  value,
  unit,
  deltaLabel,
  masked,
  className,
}: {
  label: string;
  value: number | null;
  unit: string;
  deltaLabel: string | null;
  masked?: boolean;
  className?: string;
}) {
  const display =
    value != null
      ? unit === "%"
        ? `${value}%`
        : `${value} ${unit}`
      : "—";

  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`font-[family-name:var(--font-headline)] text-[22px] font-medium leading-none text-foreground tabular-nums ${masked ? "ph-mask" : ""}`}
      >
        {display}
      </p>
      {deltaLabel ? (
        <p className="mt-1 text-xs text-success tabular-nums">{deltaLabel}</p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No trend yet</p>
      )}
    </div>
  );
}

export default BodyCompositionTrendCard;
