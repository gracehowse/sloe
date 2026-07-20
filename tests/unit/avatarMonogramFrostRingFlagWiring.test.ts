/**
 * ENG-1593 — "User-avatar monogram breaks Rule 7 on every screen — sans
 * initial, no frost-ring, plum-vs-olive fill mismatch web/mobile."
 *
 * DESIGN-CONSTITUTION.md Rule 7: "People may use serif initials only with
 * the frost-ring treatment, as a stated placeholder until real photography
 * lands." Remediation: one avatar-monogram primitive shared web + mobile
 * (`GradientAvatar` mobile / `AvatarDisc` web, both already the ONE
 * identity-fill primitive per the S5 ruling, ENG-1375) gets a `treatment`
 * prop; every ad-hoc header/identity avatar call site threads it, gated
 * behind `avatar_monogram_frost_ring_v1` (default-OFF — this is app-wide
 * chrome and no device/sim visual pass landed in this change).
 *
 * Source-string-pinned (the `screenAuditFixesParity` idiom used across this
 * repo for screens too large/stateful to mount in jsdom) across every call
 * site the ticket scopes in: the persistent header identity avatar (mobile
 * Today x2, web sidebar + Today x2) and the Profile/Settings identity
 * monogram (mobile EditorialProfileBlock + ProfileIdentityStrip, web
 * EditorialProfileBlock). Explicitly OUT of scope (different, already-
 * reviewed decisions, not touched here): household MEMBER avatars
 * (`householdMemberAccent` per-index palette — a deliberately different
 * "member" identity treatment, not Rule 7's single-person monogram), the
 * Settings header gradient card (`SettingsProfileHeaderCard.tsx`, pinned as
 * "the LAST gradient consumer" by `profileAvatarGradient.test.ts`), and the
 * marketing Pricing page auth avatar (pre-auth surface, not core app chrome).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), "utf8");

const FLAG = "avatar_monogram_frost_ring_v1";

const GRADIENT_AVATAR = read("apps/mobile/components/GradientAvatar.tsx");
const AVATAR_DISC = read("src/app/components/ui/avatar-disc.tsx");

const MOBILE_TODAY_HEADER_BAR = read("apps/mobile/components/today/TodayHeaderBar.tsx");
const MOBILE_TODAY_DATE_HEADER = read("apps/mobile/components/today/TodayDateHeader.tsx");
const MOBILE_EDITORIAL_PROFILE = read("apps/mobile/components/profile/EditorialProfileBlock.tsx");
const MOBILE_PROFILE_IDENTITY_STRIP = read("apps/mobile/components/profile/ProfileIdentityStrip.tsx");

const WEB_DESKTOP_SIDEBAR = read("src/app/components/suppr/desktop-sidebar.tsx");
const WEB_TODAY_DATE_HEADER = read("src/app/components/suppr/today-date-header.tsx");
const WEB_EDITORIAL_PROFILE = read("src/app/components/profile/EditorialProfileBlock.tsx");

const MOBILE_ANALYTICS = read("apps/mobile/lib/analytics.ts");
const WEB_TRACK = read("src/lib/analytics/track.ts");

describe("ENG-1593 — the ONE shared avatar-monogram primitive (Rule 7)", () => {
  it("GradientAvatar (mobile) exposes the frostRing treatment with the prototype's exact ring geometry", () => {
    expect(GRADIENT_AVATAR).toContain('export type AvatarMonogramTreatment = "legacy" | "frostRing"');
    // Sloe-App.html L1728 box-shadow: 0 0 0 2px var(--card), 0 0 0 3.5px var(--accent-frost)
    expect(GRADIENT_AVATAR).toMatch(/FROST_RING_GAP\s*=\s*2/);
    expect(GRADIENT_AVATAR).toMatch(/FROST_RING_WIDTH\s*=\s*3\.5/);
    expect(GRADIENT_AVATAR).toContain("Accent.frost");
    expect(GRADIENT_AVATAR).toContain("colors.card");
    expect(GRADIENT_AVATAR).toContain("FontFamily.serifMedium");
  });

  it("AvatarDisc (web) exposes the frostRing treatment with the identical box-shadow spec", () => {
    expect(AVATAR_DISC).toContain('export type AvatarMonogramTreatment = "legacy" | "frostRing"');
    expect(AVATAR_DISC).toContain(
      "0 0 0 2px var(--card), 0 0 0 3.5px var(--accent-frost)",
    );
    expect(AVATAR_DISC).toContain("var(--font-headline)");
  });

  it("mobile Today-header avatar sites (x2) gate `treatment` behind the flag", () => {
    for (const src of [MOBILE_TODAY_HEADER_BAR, MOBILE_TODAY_DATE_HEADER]) {
      expect(src).toContain(`isFeatureEnabled("${FLAG}")`);
      expect(src).toMatch(/treatment=\{[^}]*\?\s*"frostRing"\s*:\s*"legacy"\}/);
    }
  });

  it("web identity-avatar sites (sidebar + Today header x2) gate `treatment` behind the flag", () => {
    for (const src of [WEB_DESKTOP_SIDEBAR, WEB_TODAY_DATE_HEADER]) {
      expect(src).toContain(`isFeatureEnabled("${FLAG}")`);
      expect(src).toMatch(/treatment=\{[^}]*\?\s*"frostRing"\s*:\s*"legacy"\}/);
    }
  });

  it("web Profile identity monogram gates `treatment` behind the flag", () => {
    expect(WEB_EDITORIAL_PROFILE).toContain(`isFeatureEnabled("${FLAG}")`);
    expect(WEB_EDITORIAL_PROFILE).toMatch(/treatment=\{[^}]*\?\s*"frostRing"\s*:\s*"legacy"\}/);
  });

  it("mobile Profile/Settings monograms route through the shared GradientAvatar when the flag is ON — fixing the accent.primarySolid fill drift the audit traced", () => {
    // Both hand-rolled monograms previously filled from `accent.primarySolid`
    // (a theme-VARIABLE token: deep-plum #3B2A4D light / lilac #C4ACD0 dark) —
    // the audit's "two different plum shades" finding vs the Today header's
    // already-canonical `Accent.purple` (fixed damson, matches web
    // `--avatar-identity`). The flag-ON branch must use the fixed token.
    for (const src of [MOBILE_EDITORIAL_PROFILE, MOBILE_PROFILE_IDENTITY_STRIP]) {
      expect(src).toContain(`isFeatureEnabled("${FLAG}")`);
      expect(src).toMatch(/<GradientAvatar[\s\S]{0,200}fill=\{Accent\.purple\}[\s\S]{0,120}treatment="frostRing"/);
      // Flag-off keeps the original accent.primarySolid monogram intact —
      // no silent removal of the kill-switch path.
      expect(src).toContain("backgroundColor: accent.primarySolid");
    }
  });

  it("the flag is documented as default-OFF on both platforms (ENG-1593, kept in sync)", () => {
    for (const src of [MOBILE_ANALYTICS, WEB_TRACK]) {
      expect(src).toContain(FLAG);
      expect(src).toMatch(new RegExp(`\`${FLAG}\`[\\s\\S]{0,60}\\(ENG-1593\\)`));
      expect(src).toMatch(/DEFAULT-OFF/);
    }
  });

  it("household MEMBER avatars are untouched — a deliberately different identity treatment, not Rule 7's single-person monogram", () => {
    // `householdMemberAccent` per-index palette (stone/green/amber/pink…)
    // stays exactly as-is; only the single-person identity disc gets the
    // Rule 7 treatment. Guards against scope creep re-touching the household
    // glance bar / HouseholdBar chips in a future edit of these files.
    expect(WEB_DESKTOP_SIDEBAR).not.toContain("householdMemberAccent");
  });
});
