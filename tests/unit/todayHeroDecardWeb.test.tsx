/**
 * Today calorie hero DE-CARD — web parity (ENG-1247, flag today_hero_decard_v3).
 *
 * The v3 prototype `.ring-hero` is a BARE centered block (no SupprCard chrome)
 * with the status line BELOW the ring + a 56px serif-medium numeral; the carded
 * hero keeps the chip ABOVE. Source-grep guard (mirrors the mobile twin
 * apps/mobile/tests/unit/todayHeroDecard.test.tsx) so a refactor can't silently
 * collapse one path — and so the web flag stays in lock-step with mobile.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

describe("Today hero de-card — web (today_hero_decard_v3)", () => {
  const hero = read("src/app/components/suppr/today-hero-ring.tsx");
  const dial = read("src/app/components/suppr/calorie-ring-dial.tsx");

  it("reads the de-card flag", () => {
    expect(hero).toMatch(/isFeatureEnabled\("today_hero_decard_v3"\)/);
  });

  it("chip is carded-only (!decard); status LINE renders on de-card", () => {
    expect(hero).toMatch(/\{!decard \?/);
    expect(hero).toMatch(/<RingStatusLine state=\{chipState\}/);
    expect(hero).toMatch(/\{decard \?/);
  });

  it("branches the wrapper — bare div when de-carded, SupprCard otherwise", () => {
    expect(hero).toMatch(/if \(decard\) \{/);
    expect(hero).toMatch(/data-testid="today-hero-decard"/);
    expect(hero).toMatch(/<SupprCard/);
  });

  it("passes the 56px serif-medium numeral through on de-card", () => {
    expect(hero).toMatch(/numeralLarge=\{decard\}/);
    expect(dial).toMatch(/text-\[56px\] font-medium/);
  });

  it("registers the flag default-OFF (parity with mobile)", () => {
    expect(read("src/lib/analytics/track.ts")).toMatch(/"today_hero_decard_v3"/);
  });
});
