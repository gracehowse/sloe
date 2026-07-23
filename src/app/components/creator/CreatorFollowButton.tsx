"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase/browserClient";

/**
 * B5 Phase 2a (2026-04-27) — Follow / Following toggle for the web
 * creator profile page.
 *
 * Server-rendered page (`app/creator/[id]/page.tsx`) hands us the
 * creator id + the initial follower count it counted at request time.
 * This client component:
 *   - reads the authed user id from the browser supabase client;
 *   - issues a HEAD-shape `select` on `follows` to see if the current
 *     user already follows this creator;
 *   - flips state optimistically on tap, rolling back on error.
 *
 * Mobile parallel lives inline in apps/mobile/app/creator/[id].tsx —
 * same shape, same optimistic-update + rollback pattern.
 *
 * The button is hidden when:
 *   - the viewer is unauthenticated (no follow primitive without a session);
 *   - the viewer IS the creator (you can't follow yourself).
 */

export interface CreatorFollowButtonProps {
  creatorId: string;
  initialFollowerCount: number;
  className?: string;
}

export function CreatorFollowButton({
  creatorId,
  initialFollowerCount,
  className,
}: CreatorFollowButtonProps) {
  const [authedUserId, setAuthedUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followerCount, setFollowerCount] = useState<number>(initialFollowerCount);
  const [busy, setBusy] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydrate session + follow state in parallel on mount. We don't
  // render the button at all until we know whether the viewer is the
  // creator vs an external user, to avoid the brief "Follow → hidden"
  // flash on self-views.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sessionRes = await supabase.auth.getSession();
      if (cancelled) return;
      const uid = sessionRes.data.session?.user.id ?? null;
      setAuthedUserId(uid);
      if (!uid) {
        setHydrated(true);
        return;
      }
      const { data, error } = await supabase
        .from("follows")
        .select("user_id")
        .eq("creator_id", creatorId)
        .eq("user_id", uid)
        .maybeSingle();
      if (cancelled) return;
      if (!error) setIsFollowing(Boolean(data));
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const onToggle = useCallback(async () => {
    if (!authedUserId || busy) return;
    setBusy(true);
    const wasFollowing = isFollowing;
    const optimisticCount = followerCount + (wasFollowing ? -1 : 1);
    setIsFollowing(!wasFollowing);
    setFollowerCount(optimisticCount);
    try {
      if (wasFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("creator_id", creatorId)
          .eq("user_id", authedUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .upsert(
            { creator_id: creatorId, user_id: authedUserId },
            { onConflict: "creator_id,user_id" },
          );
        if (error) throw error;
      }
    } catch {
      // Roll back so the UI matches DB truth.
      setIsFollowing(wasFollowing);
      setFollowerCount(followerCount);
    } finally {
      setBusy(false);
    }
  }, [authedUserId, busy, creatorId, isFollowing, followerCount]);

  // Hide the button entirely when the viewer is unauthenticated OR
  // when the viewer IS the creator (you don't follow yourself).
  if (!hydrated) return null;
  if (!authedUserId) return null;
  if (authedUserId === creatorId) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-label={isFollowing ? "Unfollow creator" : "Follow creator"}
      className={[
        "inline-flex items-center justify-center min-w-[140px] px-6 py-2.5 rounded-full text-sm font-bold transition-colors",
        isFollowing
          ? "bg-transparent border border-border text-foreground hover:bg-muted/40"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        busy ? "opacity-60 cursor-not-allowed" : "",
        className?.includes("w-full") ? "w-full" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
