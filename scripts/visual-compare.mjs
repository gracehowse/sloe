#!/usr/bin/env node
/**
 * Prints paths for a side-by-side visual review (v49 baseline vs current).
 * Does not capture screenshots — run `npm run visual:web` and Maestro sweep first.
 */
import { access } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const BASELINE_V49 = {
  today: "docs/audits/2026-05-12-visual-sweep/mobile/dark-01-today-default.png",
  todayScrolled: "docs/audits/2026-05-12-visual-sweep/mobile/dark-02-today-scrolled.png",
  progress: "docs/audits/2026-05-12-visual-sweep/mobile/dark-30-progress-default.png",
  settings: "docs/audits/2026-05-12-visual-sweep/mobile/dark-32-settings.png",
  discover: "docs/audits/2026-05-12-visual-sweep/mobile/dark-12-discover.png",
  plan: "docs/audits/2026-05-12-visual-sweep/mobile/dark-20-plan.png",
};

const CURRENT_WEB = {
  todayMobile: "screenshots/visual-audit/today-mobile.png",
  todayDesktop: "screenshots/visual-audit/today-desktop.png",
  progressMobile: "screenshots/visual-audit/progress-mobile.png",
  settingsMobile: "screenshots/visual-audit/settings-mobile.png",
};

const PROTOTYPE = "docs/ux/claude-design-bundles/prototype/project/Suppr Prototype.html";

async function exists(rel) {
  try {
    await access(resolve(ROOT, rel));
    return true;
  } catch {
    return false;
  }
}

function line(label, rel, ok) {
  const mark = ok ? "✓" : "✗ (missing — run capture step)";
  console.log(`  ${mark} ${label}`);
  console.log(`      ${rel}`);
}

console.log("\n=== Suppr visual compare (v49 + web + Claude Design) ===\n");

console.log("0) Pick your colour master (see docs/ux/visual-design-workflow.md):");
console.log("   A) Web theme.css (warm) — recommended since web looks better");
console.log("   B) Claude Design bundle (cool grey + blue chrome)");
console.log("   C) v49 PNGs only\n");

console.log("1) Claude Design prototype (layout, not production colours):");
console.log("   npm run design:prototype");
const protoOk = await exists(PROTOTYPE);
line("Prototype HTML", PROTOTYPE, protoOk);

console.log("\n2) v49 TestFlight-era baseline (cohesive reference):");
for (const [k, p] of Object.entries(BASELINE_V49)) {
  await line(k, p, await exists(p));
}

console.log("\n3) Current web captures (npm run visual:web with dev server):");
for (const [k, p] of Object.entries(CURRENT_WEB)) {
  await line(k, p, await exists(p));
}

console.log("\n4) Current mobile captures:");
console.log("   bash apps/mobile/scripts/run-visual-sweep.sh");
console.log("   → docs/audits/visual-sweep-expanded/\n");

console.log("5) Token parity (web CSS ↔ mobile theme.ts):");
console.log("   npm test -- tests/unit/crossPlatformThemeTokens.test.ts\n");

console.log("Side-by-side checklist (Today only):");
console.log("  [ ] Page background: warm white, not cold grey");
console.log("  [ ] Cards: white on cream, visible border (#e3dccc)");
console.log("  [ ] Macro area: 2×2 tiles, gap ~10–12px, not full-width bars");
console.log("  [ ] Meals: slot headers readable; not black pills everywhere");
console.log("  [ ] Tab bar: active label not harsh black (stone ok)");
console.log("  [ ] Log FAB: only strong dark circle on screen\n");
