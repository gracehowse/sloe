/**
 * ENG-1662 — anatomy owner primitives exist on both platforms with matching
 * roles, and the first notice + AddRow consumers route through them under
 * `ui_anatomy_owners_v1`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1662 anatomy owners — files exist both platforms", () => {
  it("SupprNotice / IconButton / CountBadge exist on mobile + web", () => {
    expect(read("apps/mobile/components/ui/SupprNotice.tsx")).toMatch(
      /export function SupprNotice/,
    );
    expect(read("src/app/components/ui/suppr-notice.tsx")).toMatch(
      /export function SupprNotice/,
    );
    expect(read("apps/mobile/components/ui/IconButton.tsx")).toMatch(
      /export function IconButton/,
    );
    expect(read("src/app/components/ui/icon-button.tsx")).toMatch(
      /export function IconButton/,
    );
    expect(read("apps/mobile/components/ui/CountBadge.tsx")).toMatch(
      /export function CountBadge/,
    );
    expect(read("src/app/components/ui/count-badge.tsx")).toMatch(
      /export function CountBadge/,
    );
  });

  it("Storybook stories cover the three new web owners (Chromatic)", () => {
    expect(read("src/app/components/ui/suppr-notice.stories.tsx")).toMatch(
      /Anatomy role \*\*Notice\*\*/,
    );
    expect(read("src/app/components/ui/icon-button.stories.tsx")).toMatch(
      /Anatomy role \*\*IconButton\*\*/,
    );
    expect(read("src/app/components/ui/count-badge.stories.tsx")).toMatch(
      /Anatomy role \*\*CountBadge\*\*/,
    );
  });
});

describe("ENG-1662 anatomy owners — consumers", () => {
  it("CountBadge owns SubTabPill + SegmentedTrack badges (no inline chrome)", () => {
    const pill = read("apps/mobile/components/ui/SubTabPill.tsx");
    const track = read("apps/mobile/components/ui/SegmentedTrack.tsx");
    expect(pill).toMatch(/from ["']@\/components\/ui\/CountBadge["']/);
    expect(pill).toMatch(/<CountBadge\b/);
    expect(pill).not.toMatch(/minWidth:\s*20/);
    expect(track).toMatch(/from ["']@\/components\/ui\/CountBadge["']/);
    expect(track).toMatch(/<CountBadge\b/);
    expect(track).not.toMatch(/styles\.badge/);
  });

  it("NorthStar library-empty routes through SupprNotice under the flag", () => {
    const mobile = read(
      "apps/mobile/components/today/NorthStarBlockNonDefault.tsx",
    );
    const web = read(
      "src/app/components/suppr/north-star-block-non-default.tsx",
    );
    expect(mobile).toMatch(/ui_anatomy_owners_v1/);
    expect(mobile).toMatch(/<SupprNotice\b/);
    expect(web).toMatch(/ui_anatomy_owners_v1/);
    expect(web).toMatch(/<SupprNotice\b/);
  });

  it("AddRowButton left-aligns under the flag on both platforms", () => {
    const mobile = read("apps/mobile/components/ui/AddRowButton.tsx");
    const web = read("src/app/components/ui/add-row-button.tsx");
    expect(mobile).toMatch(/ui_anatomy_owners_v1/);
    expect(mobile).toMatch(/justifyContent: panelForm \? "flex-start"/);
    expect(web).toMatch(/ui_anatomy_owners_v1/);
    expect(web).toMatch(/panelForm \? "justify-start"/);
  });

  it("flag is default-ON on both platforms", () => {
    const mobile = read("apps/mobile/lib/analytics.ts");
    const web = read("src/lib/analytics/track.ts");
    // Assert the string appears as a Set member inside REDESIGN_DEFAULT_ON —
    // look for the quoted flag on its own line after the Set opener.
    expect(mobile).toMatch(
      /REDESIGN_DEFAULT_ON[\s\S]*?"ui_anatomy_owners_v1"[\s\S]*?KNOWN_DEFAULT_OFF_FLAGS\s*=/,
    );
    expect(web).toMatch(
      /REDESIGN_DEFAULT_ON[\s\S]*?"ui_anatomy_owners_v1"[\s\S]*?export const KNOWN_DEFAULT_OFF_FLAGS/,
    );
  });
});

describe("ENG-1662 anatomy program doc", () => {
  it("lands the role taxonomy that answers Grace's card/notice questions", () => {
    const doc = read("docs/design/2026-07-22-ui-anatomy-program.md");
    expect(doc).toMatch(/White meals card vs the lavender notice/);
    expect(doc).toMatch(/Add food/);
    expect(doc).toMatch(/SupprNotice/);
    expect(doc).toMatch(/Notice radius = 24/);
  });
});
