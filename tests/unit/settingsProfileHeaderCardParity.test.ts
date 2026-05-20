/**
 * Group G IA Batch C (2026-04-29) — Profile sidebar entry collapsed
 * into a header card on web Settings. The /profile route stays alive
 * as the full editor; the header card is the new entry point.
 *
 * This test pins the load-bearing structural contract:
 *   1. The header card lives in Settings.tsx and carries the
 *      `data-testid="settings-profile-header-card"` selector so any
 *      future visual rework can preserve the e2e hook.
 *   2. The "Edit profile" affordance routes to /home?view=profile so
 *      bookmarks and the existing App.tsx view-router resolve.
 *   3. Desktop sidebar: Settings via bottom profile entry, not a Progress
 *      sub-tab (`desktop-sidebar-profile-entry`).
 *   4. Mobile-web: Today header avatar opens settings (`md:hidden`); no
 *      YouSubTabPill on Progress/Settings routes.
 *
 * Source-level structural check — no React rendering. (The full
 * sidebar render-test lives in `desktopSidebar.test.tsx`.)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..", "..");
const SETTINGS_PATH = resolve(ROOT, "src/app/components/Settings.tsx");
const SIDEBAR_PATH = resolve(
  ROOT,
  "src/app/components/suppr/desktop-sidebar.tsx",
);
const APP_PATH = resolve(ROOT, "src/app/App.tsx");

const settings = readFileSync(SETTINGS_PATH, "utf8");
const sidebar = readFileSync(SIDEBAR_PATH, "utf8");
const app = readFileSync(APP_PATH, "utf8");

describe("Settings — profile header card (Group G IA Batch C)", () => {
  it("renders the profile header card with the canonical testID", () => {
    expect(settings).toContain('data-testid="settings-profile-header-card"');
  });

  it("Edit-profile link routes to /home?view=profile", () => {
    expect(settings).toMatch(
      /href="\/home\?view=profile"[\s\S]*?data-testid="settings-edit-profile-link"/,
    );
  });

  it("avatar uses ink primary (matches Profile.tsx + mobile GradientAvatar)", () => {
    expect(settings).toMatch(/bg-primary text-primary-foreground/);
  });

  it("tier label collapses base → Free per the Free+Pro consolidation", () => {
    expect(settings).toMatch(/userTier === "pro" \? "Pro" : "Free"/);
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
