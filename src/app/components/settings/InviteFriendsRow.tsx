"use client";

import { useCallback } from "react";

import { isFeatureEnabled } from "../../../lib/analytics/track.ts";

export function InviteFriendsRow({ userId }: { userId: string | null }) {
  const enabled = isFeatureEnabled("referral_invite_pro_v1");

  const onShare = useCallback(async () => {
    if (!userId) return;
    const url = `https://getsloe.com/i/${userId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }, [userId]);

  if (!enabled || !userId) return null;

  return (
    <button
      type="button"
      onClick={onShare}
      className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left"
    >
      <p className="text-sm font-medium text-foreground">Invite friends · earn Pro</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Share your invite link. You and your friend each get a free month when they join.
      </p>
    </button>
  );
}
