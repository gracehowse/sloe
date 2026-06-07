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
const WEB_RING = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-hero-ring.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);
const COPY = readFileSync(resolve(ROOT, "src/lib/copy/today.ts"), "utf8");

describe("Today hero layout parity", () => {
  it("canonical copy exports macro-ring toggle labels", () => {
    expect(COPY).toMatch(/MACRO_RING_TOGGLE/);
    expect(COPY).toMatch(/Show macro rings/);
    expect(COPY).toMatch(/Hide macro rings/);
  });

  it("desktop hero uses one vertical stack (no ring+2x2 side-by-side grid)", () => {
    expect(WEB_STATS).toMatch(/data-testid="today-hero-desktop"/);
    expect(WEB_STATS).toMatch(/flex flex-col items-center/);
    expect(WEB_STATS).toMatch(/data-testid="today-hero-stat-row"/);
    expect(WEB_STATS).toMatch(/grid-cols-4/);
    expect(WEB_STATS).not.toMatch(/grid-cols-\[auto_1fr\]/);
  });

  it("macro rings have an explicit toggle; the ring also taps to toggle (654:2 parity)", () => {
    // The explicit toggle button is always present (the guaranteed affordance).
    expect(WEB_STATS).toMatch(/data-testid="today-macro-rings-toggle"/);
    expect(WEB_STATS).toMatch(/MACRO_RING_TOGGLE/);
    expect(WEB_RING).toMatch(/today-macro-rings-toggle/);
    // Closing Figma 654:2 parity (commit e7790278) made the web ring tappable
    // to toggle the macro arcs, matching mobile — so the ring now wires
    // `onToggle` in addition to the explicit button.
    expect(WEB_RING).toMatch(/onToggle=\{onToggleExpanded\}/);
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
