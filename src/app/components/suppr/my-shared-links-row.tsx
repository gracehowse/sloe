"use client";

import { useState } from "react";
import { Icons } from "../ui/icons";
import { MySharedLinksDialog } from "./my-shared-links-dialog";

/**
 * ENG-1648 — "My shared links" Settings row + its dialog, extracted out of
 * Settings.tsx (a pinned megafile at its screen-line-budget cap, ENG-717)
 * so this feature's own state/markup doesn't grow that file at all — the
 * host gains exactly one import + one JSX line.
 *
 * Skips the Apple Health row's `-mx-2` hit-target treatment: Settings.tsx's
 * web-spacing-scale pin (ENG-1592) has zero headroom, so this uses the same
 * flat `px-4 py-3 bg-muted` treatment BarcodeContributionsSection's
 * neighbouring rows already use in `privacyCard`.
 */
export function MySharedLinksRow({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="settings-shared-links-row"
        className="w-full flex items-center gap-4 text-left px-4 py-3 bg-muted hover:bg-muted/80 rounded-lg transition-all text-foreground"
      >
        <Icons.share className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-medium">Shared meals</p>
          <p className="text-xs text-muted-foreground mt-1">Manage links you've shared, and revoke access</p>
        </div>
        <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
      </button>
      <MySharedLinksDialog open={open} onOpenChange={setOpen} userId={userId} />
    </>
  );
}
