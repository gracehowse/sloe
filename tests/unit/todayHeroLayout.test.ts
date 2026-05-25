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
const TRACKER = readFileSync(
  resolve(ROOT, "src/app/components/NutritionTracker.tsx"),
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

  it("macro rings are opt-in via explicit toggle (not ring tap on web)", () => {
    expect(WEB_STATS).toMatch(/data-testid="today-macro-rings-toggle"/);
    expect(WEB_STATS).toMatch(/MACRO_RING_TOGGLE/);
    expect(WEB_RING).toMatch(/today-macro-rings-toggle/);
    expect(WEB_RING).not.toMatch(/onToggle=\{onToggleExpanded\}/);
  });

  it("web + mobile default ringExpanded to collapsed", () => {
    expect(TRACKER).toMatch(/useState\(false\)/);
    expect(MOBILE).toMatch(/const \[ringExpanded, setRingExpanded\] = useState\(false\)/);
  });
});
