/**
 * Today hero — unified vertical layout + macros hidden by default.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB_STATS = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-hero-stats.tsx"),
  "utf8",
);
const WEB_STATS_DESKTOP = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-hero-stats-desktop.tsx"),
  "utf8",
);
const WEB_RING = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-hero-ring.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/_today/TodayScreen.tsx"),
  "utf8",
);
const COPY = readFileSync(resolve(ROOT, "src/lib/copy/today.ts"), "utf8");

describe("Today hero layout parity", () => {
  it("canonical copy exports treatment-agnostic macro toggle labels", () => {
    expect(COPY).toMatch(/MACRO_RING_TOGGLE/);
    expect(COPY).toMatch(/show: "Show macros"/);
    expect(COPY).toMatch(/hide: "Hide macros"/);
    // ENG design review 2026-06-13: the toggle label must NOT claim a shape
    // ("rings"/"bars") — the hero reveals sub-rings, the below-hero is bars.
    expect(COPY).not.toMatch(/(Show|Hide) macro rings/);
  });

  it("desktop hero uses one vertical stack (no ring+2x2 side-by-side grid)", () => {
    expect(WEB_STATS).toMatch(/DesktopHeroStats/);
    expect(WEB_STATS_DESKTOP).toMatch(/data-testid="today-hero-desktop"/);
    expect(WEB_STATS_DESKTOP).toMatch(/flex flex-col items-center/);
    expect(WEB_STATS_DESKTOP).toMatch(/data-testid="today-hero-stat-row"/);
    // Sloe redesign (`654:2`): the stat row is the 3-up Goal / Eaten / Bonus
    // legend (was a 4-up Logged/Target/Burned/Net grid pre-Sloe). The frame
    // shows exactly three stats under the ring.
    expect(WEB_STATS_DESKTOP).toMatch(/grid-cols-3/);
    expect(WEB_STATS_DESKTOP).not.toMatch(/grid-cols-\[auto_1fr\]/);
  });

  it("macro rings have an explicit toggle button (the guaranteed affordance)", () => {
    // ENG-1356 (2026-07-06): `sloe_v3_ring` was always-on in production
    // (REDESIGN_DEFAULT_ON) and is now collapsed — `CalorieRingDial` is the
    // only ring rendered; the legacy `DailyRing`'s tap-to-toggle
    // (`onToggle={onToggleExpanded}`) lived only in the flag-off branch that
    // never rendered in production, so this was a source-grep pinning dead
    // code, not live behaviour. `CalorieRingDial` (web) and its mobile
    // equivalent both lack a tap-to-toggle handler today — tracked as
    // ENG-1465, out of scope here.
    expect(WEB_STATS_DESKTOP).toMatch(/today-macro-rings-toggle/);
    expect(WEB_STATS_DESKTOP).toMatch(/MACRO_RING_TOGGLE/);
    expect(WEB_RING).toMatch(/today-macro-rings-toggle/);
  });

  it("mobile defaults ringExpanded to EXPANDED (Sloe multi-ring); web stays collapsed pending its parity slot", () => {
    // SLOE redesign (2026-06-03, iOS-first): the Sloe `01 · Today` hero IS a
    // multi-ring (calories + protein/carbs/fat arcs), so mobile defaults the
    // inner macro arcs ON. Web's Today hero is re-skinned in a later slot and
    // still defaults collapsed — a deliberate, temporary platform divergence
    // tracked by the rollout. Update web to `useState(true)` when its slot
    // lands.
    expect(MOBILE).toMatch(
      /const \[ringExpanded, setRingExpanded\] = useState\(true\)/,
    );
    expect(WEB_RING).toMatch(/today-macro-rings-toggle/);
  });
});
