/**
 * ENG-1344 first slice — planner.tsx's Alert-to-Toast migration, pinned by
 * source assertion rather than rendering the (5000+ line, dependency-heavy)
 * planner screen directly. The behavioural logic itself (flag branching,
 * message shape) is unit-tested in isolation in `alertOrToast.test.ts`,
 * `toast.test.tsx`, and `useToast.test.tsx` — this file's job is narrower:
 * prove planner.tsx wires them up correctly and that the migration didn't
 * silently expand past its 7-call-site scope or touch a destructive dialog.
 *
 * ENG-1631 (2026-07-21, Planner extract slice 1): the plan-templates
 * fetch's error `Alert.alert("Templates", ...)` moved verbatim from
 * planner.tsx into `usePlannerTemplates.ts`. It's still one of the 8
 * genuinely-blocking dialogs the migration deliberately left alone (a
 * Cancel/Try-again alert, not a toast candidate) — just relocated, so the
 * per-file count below dropped from 8 to 7 and the hook file now carries
 * the 8th. Total across both files is unchanged.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PLANNER_SRC = readFileSync(
  resolve(ROOT, "app/(tabs)/planner.tsx"),
  "utf8",
);
const PLANNER_TEMPLATES_HOOK_SRC = readFileSync(
  resolve(ROOT, "hooks/usePlannerTemplates.ts"),
  "utf8",
);
const ANALYTICS_SRC = readFileSync(resolve(ROOT, "lib/analytics.ts"), "utf8");

describe("planner.tsx — Alert-to-Toast migration (ENG-1344)", () => {
  it("uses the shared Toast/useToast primitive, not the retired PlanRegenerateToast", () => {
    expect(PLANNER_SRC).toMatch(/import\s*\{\s*Toast\s*\}\s*from\s*"@\/components\/ui\/Toast"/);
    expect(PLANNER_SRC).toMatch(/import\s*\{\s*useToast\s*\}\s*from\s*"@\/hooks\/useToast"/);
    // No import of the retired component — a historical mention in a doc
    // comment (explaining what this replaced) is fine and expected.
    expect(PLANNER_SRC).not.toMatch(/import\s*\{\s*PlanRegenerateToast\s*\}/);
  });

  it("renders exactly one <Toast ...> host, fed by one useToast() instance", () => {
    const toastHookCalls = PLANNER_SRC.match(/const toast = useToast\(\);/g) ?? [];
    expect(toastHookCalls.length).toBe(1);
    // Match the JSX element opening tag with its prop list start, not a
    // markdown-style `<Toast>` mention inside a comment.
    const toastRenders = PLANNER_SRC.match(/<Toast\s*\n\s*visible=/g) ?? [];
    expect(toastRenders.length).toBe(1);
  });

  it("migrates exactly the 7 named non-blocking call sites onto alertOrToast", () => {
    const expectedMessages = [
      "No alternatives",
      "No recipes available",
      "Couldn't generate plan",
      "Can't delete",
      "Log failed",
      "logged`", // the templated `${meal.recipeTitle} logged`
      "Nothing to move",
    ];
    const alertOrToastCalls = PLANNER_SRC.match(/alertOrToast\(toast\.showToast,/g) ?? [];
    expect(alertOrToastCalls.length).toBe(7);
    for (const msg of expectedMessages) {
      expect(PLANNER_SRC, `alertOrToast site for "${msg}"`).toMatch(
        new RegExp(`alertOrToast\\(toast\\.showToast,[\\s\\S]{0,80}${msg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );
    }
  });

  it("leaves the 8 genuinely blocking/destructive Alert.alert calls untouched", () => {
    // Every remaining bare Alert.alert( call must be one of the known
    // branching/destructive dialogs — never one of the 7 migrated messages.
    // ENG-1631 moved one of the 8 (the plan-templates fetch error alert)
    // into usePlannerTemplates.ts — the total across both files must still
    // be 8, split 7 (planner.tsx) + 1 (the hook).
    const rawAlertCalls = PLANNER_SRC.match(/(?<!\.)Alert\.alert\(/g) ?? [];
    expect(rawAlertCalls.length).toBe(7);
    const hookAlertCalls =
      PLANNER_TEMPLATES_HOOK_SRC.match(/(?<!\.)Alert\.alert\(/g) ?? [];
    expect(hookAlertCalls.length).toBe(1);
    expect(rawAlertCalls.length + hookAlertCalls.length).toBe(8);

    const migratedTitles = [
      '"No alternatives"',
      '"No recipes available"',
      '"Couldn\'t generate plan"',
      '"Can\'t delete"',
      '"Log failed"',
      '"Nothing to move"',
      "`${meal.recipeTitle} logged`",
    ];
    for (const title of migratedTitles) {
      // These titles must NOT appear as the first argument to a raw
      // Alert.alert( call anymore — only inside alertOrToast(...) calls
      // (the fallback branch) or nowhere at all.
      const rawUsage = new RegExp(`Alert\\.alert\\(\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
      const bareMatches = PLANNER_SRC.match(rawUsage) ?? [];
      // The only legitimate remaining occurrence is inside the
      // alertOrToast(toast.showToast, ...) helper import name collision check —
      // there should be none, since alertOrToast never itself contains the
      // literal text "Alert.alert(".
      expect(bareMatches.length, `${title} must not remain a raw Alert.alert(...) call`).toBe(0);
    }
  });

  it("known destructive/branching dialogs are still present as real Alert.alert calls", () => {
    for (const marker of [
      '"Delete plan?"',
      '"Rename plan"',
      '"Upgrade required"',
      "Alert.prompt(",
    ]) {
      expect(PLANNER_SRC, marker).toContain(marker);
    }
  });

  it("registers plan_alert_to_toast_v1 as a mobile-only default-OFF flag", () => {
    const start = ANALYTICS_SRC.indexOf("export const KNOWN_DEFAULT_OFF_FLAGS = [");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = ANALYTICS_SRC.indexOf("] as const;", start);
    expect(end).toBeGreaterThan(start);
    const body = ANALYTICS_SRC.slice(start, end);
    expect(body).toContain('"plan_alert_to_toast_v1"');
  });
});
