import Link from "next/link";
import { Icons } from "../ui/icons";
import { SupprCard } from "../ui/suppr-card";

export interface SettingsProfileHeaderCardProps {
  avatarInitial: string;
  displayLabel: string;
  tierLabel: string;
  userTier: "free" | "base" | "pro";
  authEmail?: string | null;
}

/**
 * Settings profile header card — Group G IA Batch C (2026-04-29). Avatar +
 * display name + tier pill + email + "Edit profile" link to /profile.
 *
 * Extracted from `Settings.tsx` (ENG-1458) — that file's line-budget pin
 * had no headroom for the narrow-width fix below, and this card is a
 * clean, self-contained unit (Group G IA Batch C already scoped it as
 * one visual block).
 *
 * ENG-1458 — at ≤400px (`sm:` breakpoint) the single-row layout (avatar +
 * name/pill/email column + Edit-profile button) overflowed: the name
 * truncated to a few characters, the "Free plan" pill wrapped inside
 * itself, the email truncated hard, and "View plans" wrapping was reported
 * alongside it. Fix: stack vertically below `sm:` — avatar, full-width
 * name (never truncated — it's the user's own name), pill, email, then a
 * full-width Edit-profile row — and reassemble into the original single
 * row at `sm:` and above. `whitespace-nowrap` on the pill so "Free plan"
 * can never wrap into itself again at any width.
 */
export function SettingsProfileHeaderCard({
  avatarInitial,
  displayLabel,
  tierLabel,
  userTier,
  authEmail,
}: SettingsProfileHeaderCardProps) {
  const avatar = (
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

  return (
    <SupprCard
      data-testid="settings-profile-header-card"
      padding="xl"
      className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex items-center gap-4 sm:contents">
        {avatar}
        {/* Name is full-width and never truncates below `sm:` — it's the
            user's own name, the one thing this card must never clip. */}
        <p className="sm:hidden font-[family-name:var(--font-headline)] text-xl font-medium text-foreground-brand leading-tight flex-1 min-w-0">
          {displayLabel}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        {/* Sloe DS (Figma 09 Settings `335:2`): the user's name is an
            editorial identity header — Newsreader serif, plum ink. Hidden
            here below `sm:` (rendered full-width above instead) so it
            never competes for width with the avatar + pill + email stack. */}
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
