"use client";

/**
 * ProgressBodyCompSection — ENG-1525 §4 (web).
 *
 * Plain flat card. Delta 2 (hard rule): user-OWNED latest values (body fat %,
 * lean mass from HealthKit/manual) ALWAYS render free when present — the
 * Pro-gated layer is the TREND (chart + analysis), never the user's own data.
 *
 *   - Pro            → real trend content (reuses the BodyCompositionTrendCard
 *                      data path: same API route, same `refreshKey` wiring).
 *   - Free WITH data → their values, plus a blurred mini-trend shape behind a
 *                      lock + ghost "See Pro plans".
 *   - Free, NO data  → the teaser copy only.
 *
 * Overline carries the "· Pro" suffix ONLY for free users. ph-mask on the
 * lean-mass kg (absolute weight) and body-fat values, matching the existing
 * card's masking posture (ENG-534).
 *
 * Mirror: `apps/mobile/components/progress/hierarchy/ProgressBodyCompSection`.
 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import type { BodyCompositionTrendCopy } from "../../../../lib/progress/bodyCompositionTrends";
import type { UserTier } from "../../../../lib/supabase/serverAnonClient";
import { SupprButton } from "../suppr-button";
import { SupprCard } from "../../ui/suppr-card";
import { HierarchySectionOverline } from "./hierarchy-section-overline";

export interface ProgressBodyCompSectionProps {
  userTier: UserTier;
  /** Bumped after weight/body-fat saves — refetches the Pro trend (ENG-1237). */
  refreshKey?: number;
  /** Latest user-owned body fat % (host `bodyFatPct`) — free-tier visible. */
  latestBodyFatPct: number | null;
  /** Latest user-owned lean mass kg (host-derived) — free-tier visible. */
  latestLeanMassKg: number | null;
  className?: string;
}

function ValueColumn({
  label,
  display,
  deltaLabel,
  className,
}: {
  label: string;
  display: string;
  deltaLabel?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <p className="font-[family-name:var(--font-headline)] text-[22px] font-medium leading-none text-foreground tabular-nums ph-mask">
        {display}
      </p>
      {deltaLabel !== undefined ? (
        deltaLabel ? (
          <p className="mt-1 text-xs text-success tabular-nums">{deltaLabel}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">No trend yet</p>
        )
      ) : null}
    </div>
  );
}

/** Decorative masked trend shape — a blurred wave behind the lock. Never
 *  real data (free users haven't unlocked the trend), so it carries no
 *  numbers and is aria-hidden. */
function LockedTrendShape() {
  return (
    <div
      className="relative mt-4 overflow-hidden rounded-lg"
      data-testid="hierarchy-body-comp-locked-trend"
    >
      <svg
        width="100%"
        height={56}
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden
        className="blur-[3px] opacity-40"
      >
        <path
          d="M0,22 C12,18 20,26 32,21 C44,16 52,24 64,17 C76,10 86,16 100,11"
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-muted-foreground">
        <Lock size={14} strokeWidth={2} aria-hidden />
        <span className="text-[11px] font-semibold">Trend with Pro</span>
      </div>
    </div>
  );
}

export function ProgressBodyCompSection({
  userTier,
  refreshKey = 0,
  latestBodyFatPct,
  latestLeanMassKg,
  className,
}: ProgressBodyCompSectionProps) {
  const router = useRouter();
  const isPro = userTier === "pro";
  const [copy, setCopy] = useState<BodyCompositionTrendCopy | null>(null);

  // Same data path + refreshKey wiring as BodyCompositionTrendCard (ENG-1237).
  useEffect(() => {
    let cancelled = false;
    if (!isPro) {
      setCopy(null);
      return;
    }
    void fetch("/api/progress/body-composition-trends")
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = (await res.json()) as { trends?: BodyCompositionTrendCopy };
        return payload.trends ?? null;
      })
      .then((trends) => {
        if (!cancelled) setCopy(trends);
      })
      .catch(() => {
        if (!cancelled) setCopy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPro, refreshKey]);

  const hasOwnValues = latestBodyFatPct != null || latestLeanMassKg != null;

  return (
    <SupprCard
      padding="lg"
      className={className}
      data-testid="progress-hierarchy-body-comp"
      data-locked={!isPro ? "true" : "false"}
    >
      <HierarchySectionOverline
        label={isPro ? "Body composition" : "Body composition · Pro"}
      />

      {isPro ? (
        copy?.hasReadableData ? (
          <div className="mt-4 grid grid-cols-2 gap-0 divide-x divide-border">
            <ValueColumn
              label="Body fat"
              display={copy.bodyFat.current != null ? `${copy.bodyFat.current}%` : "—"}
              deltaLabel={copy.bodyFat.deltaLabel}
            />
            <ValueColumn
              label="Lean mass"
              display={copy.leanMass.current != null ? `${copy.leanMass.current} kg` : "—"}
              deltaLabel={copy.leanMass.deltaLabel}
              className="pl-4"
            />
          </div>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            Log body fat from Apple Health or your scale — we&apos;ll show how it
            trends alongside your weight.
          </p>
        )
      ) : hasOwnValues ? (
        <>
          {/* Delta 2: the user's OWN latest values render free, always. */}
          <div
            className="mt-4 grid grid-cols-2 gap-0 divide-x divide-border"
            data-testid="hierarchy-body-comp-free-values"
          >
            <ValueColumn
              label="Body fat"
              display={latestBodyFatPct != null ? `${latestBodyFatPct}%` : "—"}
            />
            <ValueColumn
              label="Lean mass"
              display={
                latestLeanMassKg != null
                  ? `${Math.round(latestLeanMassKg * 10) / 10} kg`
                  : "—"
              }
              className="pl-4"
            />
          </div>
          <LockedTrendShape />
          <SupprButton
            variant="ghost"
            className="mt-3 w-full"
            data-testid="hierarchy-body-comp-pro-cta"
            onClick={() => router.push("/pricing")}
          >
            See Pro plans
          </SupprButton>
        </>
      ) : (
        <>
          <p className="mt-3 text-[15px] leading-relaxed text-foreground">
            Track body fat and lean mass trends over time — a quiet read on how
            your composition is shifting.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Included with Sloe Pro alongside adaptive targets and unlimited imports.
          </p>
          <SupprButton
            variant="ghost"
            className="mt-4 w-full"
            data-testid="hierarchy-body-comp-pro-cta"
            onClick={() => router.push("/pricing")}
          >
            See Pro plans
          </SupprButton>
        </>
      )}
    </SupprCard>
  );
}

export default ProgressBodyCompSection;
