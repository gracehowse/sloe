"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { isFeatureEnabled } from "../../../lib/analytics/track";

export function CreatorGoPublicPromo() {
  if (!isFeatureEnabled("creator_profile_v3")) return null;

  return (
    <div
      data-testid="creator-go-public-promo"
      className="mt-4 flex gap-3 rounded-xl border border-border bg-card p-4"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-solid">
        <Sparkles className="size-[17px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Share your own recipes</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Make a recipe public and it shows up here for your followers.
        </p>
        <Link
          href="/create-recipe"
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
        >
          <Sparkles className="size-[15px]" aria-hidden />
          Go public
        </Link>
      </div>
    </div>
  );
}

export default CreatorGoPublicPromo;
