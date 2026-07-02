import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("ENG-968 trial-end reminder day picker wiring", () => {
  it("mobile paywall wires trial reminder block and commits on trial purchase", () => {
    const paywall = readFileSync(join(ROOT, "apps/mobile/app/paywall.tsx"), "utf8");
    const block = readFileSync(
      join(ROOT, "apps/mobile/components/paywall/TrialEndReminderPaywallBlock.tsx"),
      "utf8",
    );
    const hook = readFileSync(
      join(ROOT, "apps/mobile/hooks/useTrialEndReminderPaywall.ts"),
      "utf8",
    );

    expect(paywall).toContain("TrialEndReminderPaywallBlock");
    expect(paywall).toContain("commitOnTrialStart");
    expect(block).toContain("TrialEndReminderDayPicker");
    expect(hook).toContain('isFeatureEnabled("trial_end_reminder_v1")');
    expect(hook).toContain("trial_end_reminder_day_selected");
  });

  it("web upgrade dialog wires trial reminder block on annual trial", () => {
    const dialog = readFileSync(
      join(ROOT, "src/app/components/suppr/upgrade-paywall-dialog.tsx"),
      "utf8",
    );
    const block = readFileSync(
      join(ROOT, "src/app/components/paywall/TrialEndReminderUpgradeBlock.tsx"),
      "utf8",
    );
    const hook = readFileSync(
      join(ROOT, "src/app/components/paywall/useTrialEndReminderUpgrade.ts"),
      "utf8",
    );

    expect(dialog).toContain("TrialEndReminderUpgradeBlock");
    expect(dialog).toContain("persistBeforeCheckout");
    expect(block).toContain("TrialEndReminderDayPicker");
    expect(hook).toContain('isFeatureEnabled("trial_end_reminder_v1")');
    expect(hook).toContain("trialReminderUiVisible");
  });

  it("registers trial_end_reminder_v1 default-OFF on web and mobile", () => {
    const web = readFileSync(join(ROOT, "src/lib/analytics/track.ts"), "utf8");
    const mobile = readFileSync(join(ROOT, "apps/mobile/lib/analytics.ts"), "utf8");
    expect(web).toContain('"trial_end_reminder_v1"');
    expect(mobile).toContain('"trial_end_reminder_v1"');
  });
});
