/**
 * Haptic commit-rebalance ratchet (ENG-1016).
 *
 * The design brief: a tap that COMMITS (log meal, save, add, confirm, delete)
 * fires the Medium weight; navigation / selection / stepper / scrub taps stay
 * Light. The canonical vehicles are:
 *   - `PressableScale haptic="confirm"`  → Medium impact (the primitive)
 *   - `useHaptics().confirm()`           → Medium impact (the hook)
 *   - `useWinMoment().confirmLog()`      → Medium impact (the Today log funnel)
 *
 * Two falsifiable guards so the rebalance can't silently regress:
 *
 *   1. The commit primitives MUST encode Medium. If someone downgrades the
 *      `confirm` weight back to Light, this breaks.
 *   2. A RATCHET on the number of raw `expo-haptics` call-sites in production
 *      code. Census on main was ~112 scattered raw calls; ENG-1016 consolidated
 *      the Today log funnel and migrated the unambiguous commit surfaces. New
 *      work should route commit taps through `PressableScale` / `useHaptics`,
 *      not add fresh scattered raw calls — so the count may DROP but must not
 *      GROW past the recorded ceiling.
 *
 * The ratchet is a ceiling, not an exact pin: deleting more raw calls (good)
 * keeps the test green; adding a new raw call (the anti-pattern the brief
 * targets) trips it and forces a conscious choice — route through the primitive
 * or raise the ceiling with a reason.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(__dirname, "../..");

const RAW_HAPTIC_RE =
  /Haptics\.(impactAsync|notificationAsync|selectionAsync)/g;

/** Walk the mobile production tree (app/, components/, hooks/), skipping
 *  tests, shims, node_modules, and generated dirs. */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (
      entry === "node_modules" ||
      entry === "tests" ||
      entry === ".expo" ||
      entry === "ios" ||
      entry === "android" ||
      entry === "dist"
    ) {
      continue;
    }
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".d.ts") &&
      !entry.includes("vitest.config")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function countRawHapticCallSites(): number {
  const roots = ["app", "components", "hooks"].map((d) =>
    resolve(MOBILE_ROOT, d),
  );
  let total = 0;
  for (const root of roots) {
    for (const file of collectSourceFiles(root)) {
      const src = readFileSync(file, "utf8");
      total += (src.match(RAW_HAPTIC_RE) ?? []).length;
    }
  }
  return total;
}

describe("Haptic commit-rebalance — canonical commit primitives encode Medium", () => {
  it("PressableScale haptic='confirm' fires a Medium impact", () => {
    const src = readFileSync(
      resolve(MOBILE_ROOT, "components/ui/PressableScale.tsx"),
      "utf8",
    );
    // The "confirm" weight is the canonical commit beat — Medium.
    expect(src).toContain(
      'haptic === "confirm"',
    );
    expect(src).toContain(
      "Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)",
    );
  });

  it("useHaptics().confirm() fires a Medium impact", () => {
    const src = readFileSync(resolve(MOBILE_ROOT, "hooks/useHaptics.ts"), "utf8");
    expect(src).toContain("const confirm = useCallback(");
    expect(src).toContain(
      "Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)",
    );
  });

  it("useWinMoment().confirmLog() (the Today log funnel beat) is Medium", () => {
    const src = readFileSync(
      resolve(MOBILE_ROOT, "hooks/use-win-moment.ts"),
      "utf8",
    );
    // The ordinary-log commit beat — Medium via useHaptics().confirm()
    // (ENG-1016 weight, ENG-1342 vehicle). No scattered Light impacts.
    expect(src).toContain('import { useHaptics } from "@/hooks/useHaptics"');
    expect(src).toContain("haptics.confirm()");
    expect(src).not.toContain("expo-haptics");
    expect(src).not.toContain("ImpactFeedbackStyle.Light");
  });
});

describe("Haptic commit-rebalance — raw expo-haptics ratchet (ENG-1016)", () => {
  // ENG-1342 completed the migration: every production call-site now routes
  // through `PressableScale` (5) or `useHaptics` (6). The only remaining
  // `Haptics.*` invocations live in those two canonical vehicles — 11 total.
  // Raising this ceiling means a new scattered raw call slipped in.
  const RAW_HAPTIC_CEILING = 11;

  it("does not grow the number of raw Haptics call-sites in production code", () => {
    const count = countRawHapticCallSites();
    expect(count).toBeLessThanOrEqual(RAW_HAPTIC_CEILING);
  });
});
