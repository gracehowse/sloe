"use client";

import { Icons } from "../ui/icons";
import { IconBox } from "../ui/icon-box";
import { isFeatureEnabled } from "../../../lib/analytics/track";

/**
 * DiscoverImportCard — the mobile-web import-from-Reel slab (ENG-1087/1089), the
 * viral-hook acquisition surface that leads the Discover feed below `md`.
 * Extracted from the pinned `DiscoverFeed.tsx` host so the host stays a thin
 * composition shell (ENG-1225 #14 screen-budget). `md:hidden` — desktop has the
 * permanent sidebar/import entry instead.
 *
 * `discover_import_hero_v1` ON → the raised hero affordance (solid plum icon,
 * serif title, "Paste link" pill). OFF → the legacy aubergine soft-tint nav row
 * (kill switch). The whole slab opens the importer (`onOpenImport`). testID
 * `discover-import-cta-top` preserved for the Maestro import flow.
 */
export interface DiscoverImportCardProps {
  onOpenImport: () => void;
}

export function DiscoverImportCard({ onOpenImport }: DiscoverImportCardProps) {
  return (
    <div className="md:hidden">
      {isFeatureEnabled("discover_import_hero_v1") ? (
        // ENG-1087 — hero affordance (parity with mobile discover.tsx): the
        // raised viral-hook import slab — solid plum icon, serif title, "Paste
        // link" pill. Whole slab is the tap target (opens the unified sheet / view).
        <div
          role="button"
          tabIndex={0}
          data-testid="discover-import-cta-top"
          onClick={onOpenImport}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
          className="mx-4 mt-3 rounded-3xl p-4 flex items-center gap-4 cursor-pointer transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          // ENG-1094 (Grace): confident lavender-plum accent (`--import-hero-bg`).
          style={{ background: "var(--import-hero-bg)" }}
        >
          <span className="inline-flex items-center justify-center shrink-0 size-11 rounded-full bg-primary-solid text-white [&_svg]:size-5">
            <Icons.import />
          </span>
          <div className="flex-1">
            <p className="text-foreground" style={{ fontFamily: "var(--font-headline)", fontSize: "17px", lineHeight: "22px", fontWeight: 500, letterSpacing: "-0.1px" }}>Import from TikTok, Instagram &amp; YouTube</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">Paste a link or share from any app</p>
          </div>
          <span className="shrink-0 rounded-full bg-primary-solid px-3 py-1.5 text-[13px] font-semibold text-white">Paste link</span>
        </div>
      ) : (
        // Legacy nav-row slab (flag-off / kill switch). Aubergine SOFT-TINT
        // nudge card (Sloe treatment §10, ENG-1082) — a DELIBERATE tinted
        // affordance, NOT a white recipe card. testID preserved for Maestro.
        <div
          role="button"
          tabIndex={0}
          data-testid="discover-import-cta-top"
          onClick={onOpenImport}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}
          className="mx-4 mt-3 rounded-3xl p-3.5 flex items-center gap-3 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          style={{ background: "var(--accent-primary-soft)" }}
        >
          <IconBox size="lg" tone="primary">
            <Icons.import />
          </IconBox>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-foreground">Import from TikTok, Instagram &amp; YouTube</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Paste a link or share from any app</p>
          </div>
          <Icons.forward className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export default DiscoverImportCard;
