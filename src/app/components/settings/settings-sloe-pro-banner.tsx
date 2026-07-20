/**
 * Sloe Pro banner on web Settings (Figma 09 `335:2`/`335:23`).
 *
 * Free: upgrade link to /pricing. Pro: plain status slab (no manage
 * affordance) — ENG-1615: manage/cancel lives only in SubscriptionCard.
 * Mirrors mobile `SettingsSloeProBanner`.
 */
import Link from "next/link";
import { Icons } from "../ui/icons";

export function SettingsSloeProBanner({ isPro }: { isPro: boolean }) {
  const label = (
    <span className="flex items-center gap-2.5">
      <Icons.sparkles
        className="w-[18px] h-[18px]"
        style={{ color: "var(--accent-primary-solid)" }}
        aria-hidden
      />
      <span className="text-[15px] font-semibold" style={{ color: "var(--accent-primary-solid)" }}>
        Sloe Pro
      </span>
    </span>
  );

  if (isPro) {
    return (
      <div
        data-testid="settings-sloe-pro-banner"
        aria-label="Sloe Pro — active subscription"
        className="mb-6 flex items-center justify-between rounded-card-lg card-slab px-4 py-4"
      >
        {label}
        <span className="text-sm font-semibold text-muted-foreground">Active</span>
      </div>
    );
  }

  return (
    <Link
      href="/pricing"
      data-testid="settings-sloe-pro-banner"
      aria-label="Get Sloe Pro"
      className="mb-6 flex items-center justify-between rounded-card-lg card-slab px-4 py-4 transition-colors"
    >
      {label}
      <span
        className="rounded-full px-3 py-1 text-sm font-semibold"
        style={{ color: "var(--accent-primary-solid)" }}
      >
        Upgrade
      </span>
    </Link>
  );
}
