/**
 * Privacy policy — Voice Control in Cook Mode section
 * (legal P0, 2026-05-02).
 *
 * Pins that the privacy policy at `/privacy` carries the canonical
 * "Voice control in Cook Mode" section. Source-level grep — the
 * page is a server component so a render test would require the
 * Next App Router test harness, which this repo doesn't currently
 * wire. The grep is sufficient to catch the most likely
 * regression: someone removing the section while editing the
 * sub-processors block above it.
 *
 * If the privacy contact / page structure changes, mirror the
 * canonical paragraph here from the live page so the assertion
 * stays meaningful.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE_PATH = resolve(__dirname, "../../app/privacy/page.tsx");
const SOURCE = readFileSync(PAGE_PATH, "utf8");

describe("privacy policy — Voice Control in Cook Mode section", () => {
  it("includes the canonical section heading", () => {
    expect(SOURCE).toMatch(/Voice control in Cook Mode/);
  });

  it("explains the on-device-only recognition path", () => {
    const collapsed = SOURCE.replace(/\s+/g, " ");
    expect(collapsed).toMatch(/on your device using the iOS Speech framework/);
    expect(collapsed).toMatch(
      /We do not record, store, or transmit your voice/,
    );
  });

  it("lists the canonical command vocabulary", () => {
    expect(SOURCE).toMatch(/next/);
    expect(SOURCE).toMatch(/back/);
    expect(SOURCE).toMatch(/repeat/);
    expect(SOURCE).toMatch(/pause/);
    expect(SOURCE).toMatch(/resume/);
  });

  it("tells the user how to turn the listener off", () => {
    // Source has a JSX line wrap between "Voice Control" and "off at
    // any time"; collapse whitespace before the assertion.
    const collapsed = SOURCE.replace(/\s+/g, " ");
    expect(collapsed).toMatch(/turn Voice Control off at any time/);
  });
});
