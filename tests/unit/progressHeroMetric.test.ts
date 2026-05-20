import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WEB_SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/suppr/progress-hero-metric.tsx"),
  "utf-8",
);
const MOBILE_SRC = readFileSync(
  resolve(__dirname, "../../apps/mobile/components/progress/ProgressHeroMetric.tsx"),
  "utf-8",
);

describe("ProgressHeroMetric (ENG-616)", () => {
  it("web component renders a ring with adherence percentage", () => {
    expect(WEB_SRC).toContain("progress-hero-pct");
    expect(WEB_SRC).toContain("adherencePct");
    expect(WEB_SRC).toContain("strokeDashoffset");
  });

  it("mobile component renders a ring with adherence percentage", () => {
    expect(MOBILE_SRC).toContain("progress-hero-pct");
    expect(MOBILE_SRC).toContain("adherencePct");
    expect(MOBILE_SRC).toContain("strokeDashoffset");
  });

  it("web and mobile use the same ring geometry", () => {
    const webRingSize = WEB_SRC.match(/RING_SIZE\s*=\s*(\d+)/)?.[1];
    const mobileRingSize = MOBILE_SRC.match(/RING_SIZE\s*=\s*(\d+)/)?.[1];
    expect(webRingSize).toBe(mobileRingSize);
    expect(webRingSize).toBe("120");

    const webStroke = WEB_SRC.match(/STROKE\s*=\s*(\d+)/)?.[1];
    const mobileStroke = MOBILE_SRC.match(/STROKE\s*=\s*(\d+)/)?.[1];
    expect(webStroke).toBe(mobileStroke);
  });

  it("web shows empty state when no data", () => {
    expect(WEB_SRC).toContain("Log meals on Today to see your score here.");
  });

  it("mobile shows empty state when no data", () => {
    expect(MOBILE_SRC).toContain("Log meals on Today to see your score here.");
  });

  it("adherence tone uses green for 90-110%", () => {
    expect(WEB_SRC).toMatch(/90.*110.*success|success.*90.*110/s);
    expect(MOBILE_SRC).toMatch(/90.*110.*success|success.*90.*110/s);
  });

  it("shows streak when positive", () => {
    expect(WEB_SRC).toContain("streak > 0");
    expect(MOBILE_SRC).toContain("streak > 0");
  });
});
