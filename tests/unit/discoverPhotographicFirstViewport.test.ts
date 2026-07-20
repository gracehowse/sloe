import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("ENG-1618 photographic Discover first viewport", () => {
  it("keeps the default-on kill switch in parity across web and mobile", () => {
    const mobileFlags = readRepoFile("apps/mobile/lib/analytics.ts");
    const webFlags = readRepoFile("src/lib/analytics/track.ts");

    expect(mobileFlags).toContain('"discover_photographic_first_view_v1"');
    expect(webFlags).toContain('"discover_photographic_first_view_v1"');
  });

  it("puts food before creator chrome on the native default feed", () => {
    const source = readRepoFile("apps/mobile/app/(tabs)/discover.tsx");
    const firstView = source.indexOf('<DiscoverQuickWeeknight placement="first"');
    const creatorRail = source.indexOf("<CreatorRail", firstView);

    expect(firstView).toBeGreaterThan(-1);
    expect(creatorRail).toBeGreaterThan(firstView);
    expect(source).toContain('<DiscoverQuickWeeknight placement="legacy"');
  });

  it("puts food before creator chrome on mobile-web without moving the desktop hero", () => {
    const source = readRepoFile("src/app/components/DiscoverFeed.tsx");
    const firstView = source.indexOf('<DiscoverQuickWeeknight placement="first"');
    const creatorRail = source.indexOf("{creatorRail}", firstView);

    expect(firstView).toBeGreaterThan(-1);
    expect(creatorRail).toBeGreaterThan(firstView);
    expect(source).toContain('<DiscoverQuickWeeknight placement="legacy"');
  });
});
