"use client";

import { isFeatureEnabled } from "@/lib/analytics/track";
import { Icons } from "../ui/icons";

interface SettingsPageChromeProps {
  legacyRadius?: "full" | "xl";
  onBack?: () => void;
}

/**
 * Shared Settings page identity for the single- and two-pane layouts.
 *
 * NOT a `ScreenChrome` call site, deliberately (design-consistency pass,
 * 2026-07-24): `ScreenChrome` is a full-bleed sticky app bar with its own
 * `px-6` and a bottom hairline. Both Settings layouts mount this block
 * *in-flow* inside `product-shell py-8` (`Settings.tsx` and
 * `SettingsTwoPaneShell.tsx` each wrap it in `mb-8`), so routing it through
 * `ScreenChrome` would double the horizontal padding and draw a bordered bar
 * across the middle of a padded page. What it DOES share is the piece that was
 * actually drifting — the eyebrow: under `design_consistency_v1` this renders
 * the canonical treatment byte-for-byte (11/600/0.12em FULL-ink caps + a
 * hairline `border` rule to the margin), matching `ScreenChrome` on web and
 * `ScreenSectionChrome`/`Type.eyebrow` on mobile Settings. The old
 * tertiary-ink 0.1em eyebrow stays as the kill switch.
 */
export function SettingsPageChrome({
  legacyRadius = "full",
  onBack,
}: SettingsPageChromeProps) {
  const consistencyChrome = isFeatureEnabled("primary_screen_chrome_v1");
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");

  return (
    <div
      className={
        consistencyChrome && onBack ? "flex items-start gap-3" : undefined
      }
    >
      {consistencyChrome && onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-[background-color,transform] hover:bg-[var(--background-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 md:hidden"
        >
          <Icons.arrowLeft className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        {consistencyChrome ? (
          <div className="mb-2">
            {unifiedChrome ? (
              <div className="mb-1 flex items-center gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
                  Your account
                </span>
                <span className="flex-1 h-px bg-border" />
              </div>
            ) : (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-foreground-tertiary">
                Your account
              </p>
            )}
            <h1 className="page-title text-foreground-brand">Settings</h1>
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-3">
            <div
              className={`p-2 ${legacyRadius === "xl" ? "rounded-xl" : "rounded-full"}`}
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--foreground-brand) 10%, transparent)",
              }}
            >
              <Icons.settings
                className="h-5 w-5"
                style={{ color: "var(--foreground-brand)" }}
              />
            </div>
            <h1 className="font-[family-name:var(--font-headline)] text-3xl font-medium tracking-tight text-foreground-brand">
              Settings
            </h1>
          </div>
        )}
        <p className="text-foreground-tertiary">
          Manage your account and preferences
        </p>
      </div>
    </div>
  );
}
