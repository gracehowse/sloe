"use client";

/**
 * ProgressYourWeekSection — ENG-1525 §5 (web).
 *
 * Plain flat card: a serif verdict sentence (the host computes it via the
 * `resolveDigestHeadline` machinery), ONE net-new texture line (usual-meal
 * insight, else best day — from `buildDigestWeekView`), and a ghost Share.
 * NO restated avg/streak numerals — those live in §2.
 *
 * Share mirrors the Digest card's ownership exactly: fire
 * `weekly_recap_shared`, then `navigator.share` with a clipboard fallback,
 * `shareText` = host `formatRecapForShare(recap)`. Disabled (with the
 * disabled state visible) when there's nothing to share.
 *
 * The blended DigestStoryCard does NOT render on the new branch — this
 * section is the only weekly-narrative surface.
 *
 * Mirror: `apps/mobile/components/progress/hierarchy/ProgressYourWeekSection`.
 */

import * as React from "react";
import { useCallback } from "react";

import { AnalyticsEvents } from "../../../../lib/analytics/events";
import { track } from "../../../../lib/analytics/track";
import { Icons } from "../../ui/icons";
import { SupprCard } from "../../ui/suppr-card";
import { SupprButton } from "../suppr-button";
import { HierarchySectionOverline } from "./hierarchy-section-overline";

export interface YourWeekBestDay {
  label: string;
  calories: number;
  protein: number;
}

export interface YourWeekUsualMeal {
  name: string;
  count: number;
}

export interface ProgressYourWeekSectionProps {
  /** Recap week key — share analytics payload (matches Digest). */
  weekKey: string;
  /** e.g. "8–14 Jul" — quiet context under the verdict. */
  weekLabel: string;
  /** Host-computed verdict (`resolveDigestHeadline` output). */
  headline: string;
  /** Usual-meal celebration (preferred texture) — from the recap insight. */
  usualMeal: YourWeekUsualMeal | null;
  /** Best day (fallback texture) — `recap.bestDay` from buildDigestWeekView. */
  bestDay: YourWeekBestDay | null;
  /** Host `formatRecapForShare(recap)`. */
  shareText: string;
  /** True when there's nothing to share (empty week / offline). */
  shareDisabled?: boolean;
  /** Optional extra host hook, fired alongside the share (Digest parity). */
  onShare?: () => void;
  className?: string;
}

/** ONE texture line: usual-meal insight beats best day; neither → null.
 *  Skips the best-day line when the verdict already names that day (the
 *  `resolveDigestHeadline` closest-to-target branch) — no echoing. */
function textureLine(
  usualMeal: YourWeekUsualMeal | null,
  bestDay: YourWeekBestDay | null,
  headline: string,
): string | null {
  if (usualMeal && usualMeal.count >= 2) {
    return `${usualMeal.name} carried the week — logged ${usualMeal.count} times.`;
  }
  if (bestDay && !headline.includes(bestDay.label)) {
    return `${bestDay.label} was your closest day — ${Math.round(bestDay.calories).toLocaleString()} kcal.`;
  }
  return null;
}

export function ProgressYourWeekSection({
  weekKey,
  weekLabel,
  headline,
  usualMeal,
  bestDay,
  shareText,
  shareDisabled = false,
  onShare,
  className,
}: ProgressYourWeekSectionProps) {
  const handleShare = useCallback(async () => {
    // Same event + payload family as Digest's handleShare (single analytics
    // vocabulary for week sharing); `surface` disambiguates the new branch.
    track(AnalyticsEvents.weekly_recap_shared, {
      weekKey,
      platform: "web",
      surface: "progress_hierarchy_v1",
    });
    onShare?.();
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav && "share" in nav && typeof nav.share === "function") {
        await nav.share({ title: "My week on Sloe", text: shareText });
        return;
      }
      if (nav?.clipboard && typeof nav.clipboard.writeText === "function") {
        await nav.clipboard.writeText(shareText);
      }
    } catch {
      /* user cancelled — expected on some browsers */
    }
  }, [weekKey, shareText, onShare]);

  const texture = textureLine(usualMeal, bestDay, headline);

  return (
    <SupprCard padding="lg" className={className} data-testid="progress-hierarchy-your-week">
      <HierarchySectionOverline label="Your week" />
      <p
        data-testid="hierarchy-your-week-verdict"
        className="mt-2 font-[family-name:var(--font-headline)] text-[22px] font-medium leading-snug text-foreground-brand"
      >
        {headline}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{weekLabel}</p>
      {texture ? (
        <p
          data-testid="hierarchy-your-week-texture"
          className="mt-2 text-[13px] leading-relaxed text-muted-foreground"
        >
          {texture}
        </p>
      ) : null}
      <SupprButton
        variant="ghost"
        className="mt-3 -ml-3"
        data-testid="hierarchy-your-week-share"
        disabled={shareDisabled}
        aria-label="Share week"
        onClick={() => void handleShare()}
      >
        <Icons.share className="h-3.5 w-3.5" aria-hidden />
        Share week
      </SupprButton>
    </SupprCard>
  );
}

export default ProgressYourWeekSection;
