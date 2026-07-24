"use client";

import Link from "next/link";
import { isFeatureEnabled } from "@/lib/analytics/track";
import { formatSettingsProfileSubline } from "@/lib/settings/settingsProfileStats";
import { Icons } from "../ui/icons";
import { AvatarDisc } from "../ui/avatar-disc";
import { SupprCard } from "../ui/suppr-card";

export interface SettingsProfileHeaderCardProps {
  avatarInitial: string;
  displayLabel: string;
  tierLabel: string;
  userTier: "free" | "base" | "pro";
  authEmail?: string | null;
}

/**
 * Settings account card — the ONE place web Settings states who you are and
 * which plan you're on.
 *
 * Design-consistency pass (2026-07-24, `design_consistency_v1`): Settings used
 * to state plan status FOUR times above the fold — this card's tier pill, the
 * standalone Sloe Pro banner, the "Your plan" card's pill, and (below the fold)
 * SubscriptionCard — and printed the email twice (here and in "Your plan").
 * The unified path collapses the identity block to avatar + name +
 * "email · Free plan" on ONE subline, exactly matching the mobile Settings
 * profile row (`SettingsBundleContent`), and hands every plan ACTION to
 * SubscriptionCard (mobile: the Membership card). The subline string comes from
 * the shared `formatSettingsProfileSubline` helper both platforms use, so the
 * two surfaces can't drift apart again.
 *
 * Avatar: the shared `AvatarDisc` identity disc — the same flat damson chip the
 * Today header, sidebar, pricing header, and Profile monogram render (S5 avatar
 * ruling, ENG-1375). The 56px inline `linear-gradient` + `boxShadow` this card
 * used to hand-roll was the last gradient consumer AND the only drop-shadowed
 * avatar in the app; the shadow also contradicted the flat-card ruling
 * (ENG-1497). It survives in the flag-OFF branch as the kill switch.
 *
 * Flag-OFF (kill switch) keeps the pre-pass rendering verbatim: gradient
 * avatar, tier pill, separate email line, and the ENG-1458 narrow-width
 * double-name reflow.
 *
 * ENG-1458 — at ≤400px (`sm:` breakpoint) the single-row layout (avatar +
 * name/pill/email column + Edit-profile button) overflowed: the name
 * truncated to a few characters, the "Free plan" pill wrapped inside
 * itself, the email truncated hard, and "View plans" wrapping was reported
 * alongside it. Fix: stack vertically below `sm:` and reassemble into the
 * original single row at `sm:` and above. The unified path keeps that
 * behaviour with ONE name element (`sm:truncate` — wraps rather than clips
 * below `sm:`, truncates once there's a row to truncate inside).
 */
export function SettingsProfileHeaderCard({
  avatarInitial,
  displayLabel,
  tierLabel,
  userTier,
  authEmail,
}: SettingsProfileHeaderCardProps) {
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  const avatarFrostRingV1 = isFeatureEnabled("avatar_monogram_frost_ring_v1");

  const legacyAvatar = (
    <div
      aria-hidden
      className="w-14 h-14 rounded-full grid place-items-center text-lg font-bold text-white shrink-0"
      style={{
        background:
          "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, var(--avatar-gradient-accent)) 100%)",
        boxShadow: "0 2px 8px color-mix(in srgb, var(--primary) 25%, transparent)",
      }}
    >
      {avatarInitial}
    </div>
  );

  const pill = (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide mt-1 ${
        userTier === "pro" ? "bg-primary/10 text-primary-solid" : "bg-muted text-muted-foreground"
      }`}
    >
      {tierLabel} plan
    </span>
  );

  const editProfileLink = (
    <Link
      href="/profile"
      data-testid="settings-edit-profile-link"
      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-muted/60 px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors sm:w-auto w-full"
      aria-label="Edit profile"
    >
      Edit profile
      <Icons.forward className="w-4 h-4" aria-hidden />
    </Link>
  );

  if (unifiedChrome) {
    // Web Settings has no saved-recipe / streak counts plumbed in (mobile
    // reads them from `profileData`), so stats are `hidden` here and the
    // subline is "email · Free plan" — the identical shape mobile renders for
    // a user with no stats yet.
    const subline = formatSettingsProfileSubline(
      { email: authEmail, planLabel: `${tierLabel} plan` },
      { mode: "hidden" },
    );

    return (
      <SupprCard
        data-testid="settings-profile-header-card"
        padding="xl"
        className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div className="flex items-center gap-4 min-w-0 sm:flex-1">
          <AvatarDisc
            initial={avatarInitial}
            size={52}
            treatment={avatarFrostRingV1 ? "frostRing" : "legacy"}
          />
          <div className="min-w-0 flex-1">
            {/* Sloe DS (Figma 09 Settings `335:2`): the user's name is an
                editorial identity header — Newsreader serif, plum ink. */}
            <p className="font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand leading-tight sm:truncate">
              {displayLabel}
            </p>
            {/* Two lines before it clips, matching mobile's
                `numberOfLines={2}` on the same subline — a long email plus
                the plan label overflows one line at narrow widths, and
                clipping the plan the card exists to state is the one thing
                this line must not do. */}
            <p
              data-testid="settings-profile-subline"
              className="mt-1 text-xs text-muted-foreground line-clamp-2"
            >
              {subline}
            </p>
          </div>
        </div>
        {editProfileLink}
      </SupprCard>
    );
  }

  return (
    <SupprCard
      data-testid="settings-profile-header-card"
      padding="xl"
      className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex items-center gap-4 sm:contents">
        {legacyAvatar}
        {/* Name is full-width and never truncates below `sm:` — it's the
            user's own name, the one thing this card must never clip. */}
        <p className="sm:hidden font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand leading-tight flex-1 min-w-0">
          {displayLabel}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="hidden sm:block font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand leading-tight truncate">
          {displayLabel}
        </p>
        {pill}
        {authEmail ? (
          <p className="text-xs text-muted-foreground truncate mt-1">{authEmail}</p>
        ) : null}
      </div>
      {editProfileLink}
    </SupprCard>
  );
}
