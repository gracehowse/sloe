"use client";

import * as React from "react";
import { Copy, Gift } from "lucide-react";

import { Button } from "../ui/button";
import type { ReferralReward } from "@/lib/referrals/referralClient";

export function ReferralRewardCard({
  reward,
  loading,
  error,
}: {
  reward: ReferralReward | null;
  loading: boolean;
  error: string | null;
}) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = React.useCallback(async () => {
    if (!reward?.referralUrl) return;
    await navigator.clipboard.writeText(reward.referralUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [reward?.referralUrl]);

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4" data-testid="referral-reward-card">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
          <Gift className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Give 30 Pro days</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Share your Sloe link. When a friend joins, you both earn a 30-day Pro reward.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading your link…</p>
      ) : error ? (
        <p className="text-xs text-destructive">Couldn't load your referral link.</p>
      ) : reward ? (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2">
            <p className="truncate text-xs font-medium text-foreground">{reward.referralUrl}</p>
          </div>
          <Button type="button" variant="outline" onClick={onCopy} aria-label="Copy referral link">
            <Copy className="h-4 w-4" aria-hidden />
            <span className="sr-only">Copy referral link</span>
          </Button>
        </div>
      ) : null}

      {copied && <p className="text-xs font-medium text-primary">Copied.</p>}
    </div>
  );
}
