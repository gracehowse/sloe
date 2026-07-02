import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

describe("ENG-968 trial-end reminder day picker wiring", () => {
  it("mobile paywall mounts TrialEndReminderDayPicker behind trial_end_reminder_v1", () => {
    const src = readFileSync(join(ROOT, "apps/mobile/app/paywall.tsx"), "utf8");
    expect(src).toContain("TrialEndReminderDayPicker");
    expect(src).toContain('isFeatureEnabled("trial_end_reminder_v1")');
    expect(src).toContain("commitTrialEndReminderOnTrialStart");
    expect(src).toContain("trial_end_reminder_day_selected");
  });

  it("web upgrade dialog mounts TrialEndReminderDayPicker on annual trial", () => {
    const src = readFileSync(
      join(ROOT, "src/app/components/suppr/upgrade-paywall-dialog.tsx"),
      "utf8",
    );
    expect(src).toContain("TrialEndReminderDayPicker");
    expect(src).toContain('isFeatureEnabled("trial_end_reminder_v1")');
    expect(src).toContain("trialReminderUiVisible");
  });

  it("registers trial_end_reminder_v1 default-OFF on web and mobile", () => {
    const web = readFileSync(join(ROOT, "src/lib/analytics/track.ts"), "utf8");
    const mobile = readFileSync(join(ROOT, "apps/mobile/lib/analytics.ts"), "utf8");
    expect(web).toContain('"trial_end_reminder_v1"');
    expect(mobile).toContain('"trial_end_reminder_v1"');
  });
});
