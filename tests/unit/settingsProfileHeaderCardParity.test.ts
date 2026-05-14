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
 *   3. The sidebar's `you` sub-tab list is exactly Progress + Settings
 *      (Profile is gone) and `profile` remains in the `leaves` array
 *      so being on /profile still highlights "More" (renamed 2026-05-12).
 *   4. Mobile-web YouSubTabPill in App.tsx mirrors the sidebar — 2
 *      pills, no "profile" id.
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

  it("avatar uses the brand gradient (matches Profile.tsx + mobile)", () => {
    expect(settings).toContain(
      "linear-gradient(135deg, #4c6ce0 0%, #e04888 100%)",
    );
  });

  it("tier label collapses base → Free per the Free+Pro consolidation", () => {
    expect(settings).toMatch(/userTier === "pro" \? "Pro" : "Free"/);
  });
});

describe("DesktopSidebar — You sub-tabs (Group G IA Batch C)", () => {
  it("you sub-tab list is exactly Progress + Settings (no Profile)", () => {
    // SUB_TABS.you in desktop-sidebar.tsx
    const youSubTabs = sidebar.match(
      /you:\s*\[([\s\S]*?)\],/,
    );
    expect(youSubTabs).not.toBeNull();
    const block = youSubTabs![1];
    expect(block).toMatch(/view:\s*"progress"/);
    expect(block).toMatch(/view:\s*"settings"/);
    expect(block).not.toMatch(/view:\s*"profile"/);
  });

  it("/profile leaf still maps to you primary so the sidebar highlights correctly", () => {
    expect(sidebar).toMatch(
      /leaves:\s*\[\s*"progress",\s*"profile",\s*"settings",/,
    );
  });
});

describe("Mobile-web YouSubTabPill — Group G IA Batch C", () => {
  it("renders exactly two pills (Progress / Settings)", () => {
    // Slice the YouSubTabPill component body and inspect its items
    // array — drift on the labels would surface here before the e2e
    // suite catches it.
    const youPill = app.match(
      /function YouSubTabPill[\s\S]*?accessibilityLabel="You sections"/,
    );
    expect(youPill).not.toBeNull();
    const block = youPill![0];
    expect(block).toMatch(/id:\s*"progress",\s*label:\s*"Progress"/);
    expect(block).toMatch(/id:\s*"settings",\s*label:\s*"Settings"/);
    expect(block).not.toMatch(/id:\s*"profile"/);
  });

  it("YouSubTabPill type signature drops 'profile' from the union", () => {
    expect(app).toMatch(
      /currentView:\s*"progress"\s*\|\s*"settings";/,
    );
    expect(app).not.toMatch(/currentView:\s*"progress"\s*\|\s*"profile"\s*\|\s*"settings";/);
  });

  it("/profile screen renders with Settings highlighted on the mobile-web pill", () => {
    expect(app).toMatch(
      /case "profile":[\s\S]*?<YouSubTabPill currentView="settings"/,
    );
  });
});
