/**
 * Group G IA Batch C (2026-04-29) — Profile sidebar entry collapsed
 * into a header card on web Settings. The /profile route stays alive
 * as the full editor; the header card is the new entry point.
 *
 * This test pins the load-bearing structural contract:
 *   1. The header card carries the `data-testid="settings-profile-header-card"`
 *      selector so any future visual rework can preserve the e2e hook.
 *   2. The "Edit profile" affordance routes to /profile so
 *      bookmarks and the existing App.tsx view-router resolve.
 *   3. Desktop sidebar: Settings via bottom profile entry, not a Progress
 *      sub-tab (`desktop-sidebar-profile-entry`).
 *   4. Mobile-web: Today header avatar opens settings (`md:hidden`); no
 *      YouSubTabPill on Progress/Settings routes.
 *
 * Source-level structural check — no React rendering. (The full
 * sidebar render-test lives in `desktopSidebar.test.tsx`.)
 *
 * ENG-1458: the card's JSX was extracted to
 * `src/app/components/settings/SettingsProfileHeaderCard.tsx` (narrow-width
 * reflow fix; Settings.tsx's line-budget pin had no headroom for it inline).
 * `settings` still owns the label-computation logic (`profileTierLabel`
 * etc.) and passes it as props — those assertions stay on `settings`;
 * the card-markup assertions moved to `headerCard`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const SETTINGS_PATH = resolve(ROOT, "src/app/components/Settings.tsx");
const HEADER_CARD_PATH = resolve(
  ROOT,
  "src/app/components/settings/SettingsProfileHeaderCard.tsx",
);
const PRO_BANNER_PATH = resolve(
  ROOT,
  "src/app/components/settings/settings-sloe-pro-banner.tsx",
);
const SIDEBAR_PATH = resolve(
  ROOT,
  "src/app/components/suppr/desktop-sidebar.tsx",
);
const APP_PATH = resolve(ROOT, "src/app/App.tsx");

const settings = readFileSync(SETTINGS_PATH, "utf8");
const headerCard = readFileSync(HEADER_CARD_PATH, "utf8");
const sidebar = readFileSync(SIDEBAR_PATH, "utf8");
const app = readFileSync(APP_PATH, "utf8");

describe("Settings — profile header card (Group G IA Batch C)", () => {
  it("renders the profile header card with the canonical testID", () => {
    expect(headerCard).toContain('data-testid="settings-profile-header-card"');
  });

  it("Edit-profile link routes to /profile", () => {
    expect(headerCard).toMatch(
      /href="\/profile"[\s\S]*?data-testid="settings-edit-profile-link"/,
    );
  });

  it("avatar uses gradient (matches mobile GradientAvatar)", () => {
    expect(headerCard).toContain("linear-gradient");
    expect(headerCard).toContain("var(--primary)");
  });

  it("tier label collapses base → Free per the Free+Pro consolidation", () => {
    expect(settings).toMatch(/userTier === "pro" \? "Pro" : "Free"/);
  });
});

describe("Settings — Figma `335:2` frame reskin (web parity)", () => {
  it("renders the Sloe Pro banner: free Upgrade link; Pro Active status (ENG-1615)", () => {
    // ENG-1615: Pro manage lives only in SubscriptionCard — banner is
    // status-only for pro. Free → /pricing with Upgrade pill.
    // Markup lives in settings-sloe-pro-banner.tsx (screen-budget extract).
    expect(settings).toContain("SettingsSloeProBanner");
    const banner = readFileSync(PRO_BANNER_PATH, "utf8");
    expect(banner).toContain('data-testid="settings-sloe-pro-banner"');
    expect(banner).toMatch(/>\s*Sloe Pro\s*</);
    expect(banner).toContain('href="/pricing"');
    expect(banner).toMatch(/>\s*Active\s*</);
    expect(banner).toMatch(/>\s*Upgrade\s*</);
    expect(banner).not.toContain("/account/billing");
  });

  it("the profile name reads in the Newsreader serif display face", () => {
    // Frame `335:2`: the user's name is an editorial identity header in
    // the serif display face (plum ink), not sans-bold. ENG-1458: the
    // card now renders it twice (narrow-stack + `sm:` row); either match
    // proves the contract.
    expect(headerCard).toMatch(
      /font-\[family-name:var\(--font-headline\)\][^"]*text-foreground-brand[^"]*"[^>]*>\s*\{displayLabel\}/,
    );
  });

  it("the plan label reads 'Free plan' / 'Pro plan'", () => {
    expect(headerCard).toMatch(/\{tierLabel\} plan/);
  });
});

describe("DesktopSidebar — Progress primary + profile entry (2026-05-19 IA)", () => {
  it("Progress primary has no sub-tabs; Settings opens from profile entry", () => {
    expect(sidebar).toMatch(/you:\s*\[\s*\]/);
    expect(sidebar).toMatch(/label:\s*"Progress"/);
    expect(sidebar).toMatch(/data-testid="desktop-sidebar-profile-entry"/);
    expect(sidebar).toMatch(/onNavigate\("settings"\)/);
    expect(sidebar).not.toMatch(/label:\s*"More"/);
  });

  it("settings and profile are not Progress-tab leaves", () => {
    expect(sidebar).not.toMatch(
      /leaves:\s*\[\s*"progress",\s*"profile",\s*"settings",/,
    );
  });
});

describe("Web Today header — settings avatar mobile-web only", () => {
  const headerPath = resolve(ROOT, "src/app/components/suppr/today-date-header.tsx");
  const header = readFileSync(headerPath, "utf8");

  it("avatar opens settings and is hidden on md+ (sidebar owns desktop entry)", () => {
    expect(header).toMatch(/onClick={onOpenSettings}/);
    expect(header).toMatch(/aria-label="Open settings"/);
    expect(header).toMatch(/className="[^"]*md:hidden/);
  });
});

describe("Mobile-web — Progress tab without YouSubTabPill (2026-05-19)", () => {
  it("Progress render path does not mount YouSubTabPill", () => {
    expect(app).not.toMatch(/case "progress":[\s\S]*?<YouSubTabPill/);
  });

  it("YouSubTabPill type signature drops 'profile' from the union", () => {
    expect(app).toMatch(
      /currentView:\s*"progress"\s*\|\s*"settings";/,
    );
    expect(app).not.toMatch(/currentView:\s*"progress"\s*\|\s*"profile"\s*\|\s*"settings";/);
  });

  it("/profile screen does not mount YouSubTabPill (Settings is avatar-entry)", () => {
    expect(app).not.toMatch(/case "profile":[\s\S]*?<YouSubTabPill/);
  });
});
