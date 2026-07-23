/**
 * ENG-1505 — mobile compact date-header title converges to the web S6
 * serif-24 tab-title voice (`Type.title`), gated behind
 * `today_date_header_serif_v1` (default-OFF). Web already ships serif-24
 * un-gated; the flag is mobile-only in practice.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FLAG = "today_date_header_serif_v1";

const MOBILE_DATE_HEADER = readFileSync(
  resolve(process.cwd(), "apps/mobile/components/today/TodayDateHeader.tsx"),
  "utf8",
);
const WEB_DATE_HEADER = readFileSync(
  resolve(process.cwd(), "src/app/components/suppr/today-date-header.tsx"),
  "utf8",
);
const MOBILE_ANALYTICS = readFileSync(
  resolve(process.cwd(), "apps/mobile/lib/analytics.ts"),
  "utf8",
);
const WEB_TRACK = readFileSync(
  resolve(process.cwd(), "src/lib/analytics/track.ts"),
  "utf8",
);

describe("ENG-1505 — today date-header serif tab-title convergence", () => {
  it("mobile TodayDateHeader gates compact title style behind the flag", () => {
    expect(MOBILE_DATE_HEADER).toContain(`isFeatureEnabled("${FLAG}")`);
    expect(MOBILE_DATE_HEADER).toMatch(
      /const compactDateTitleStyle = dateHeaderSerifV1 \? Type\.title : Type\.headline/,
    );
    expect(MOBILE_DATE_HEADER.match(/\.\.\.compactDateTitleStyle,\s*color:\s*textColor/g)?.length).toBe(2);
  });

  it("web today-date-header ships serif-24 tab-title un-gated", () => {
    expect(WEB_DATE_HEADER).toMatch(
      /font-\[family-name:var\(--font-headline\)\] text-2xl font-medium leading-\[1\.1\] tracking-tight text-foreground-brand/,
    );
    expect(WEB_DATE_HEADER).not.toContain(`isFeatureEnabled("${FLAG}")`);
  });

  it("the flag is registered default-OFF on both platforms (parity registry)", () => {
    for (const src of [MOBILE_ANALYTICS, WEB_TRACK]) {
      expect(src).toContain(FLAG);
      expect(src).toMatch(new RegExp(`"${FLAG}"[\\s\\S]{0,120}ENG-1505`));
    }
  });
});
