/**
 * ENG-1429 — web ↔ mobile parity for the Verified/Estimated confidence chip on
 * the AI-log review surfaces.
 *
 * The chip is a per-surface decision, and the two platforms must AGREE on which
 * surfaces show it — otherwise a voice-logged item reads differently on web vs
 * iOS. This is a source-pin parity test (same style as
 * `foodSearchConfidenceTierParity.test.ts` / `aiLogReviewParity.test.ts`): it
 * reads the review-row source on each platform and asserts:
 *
 *   VOICE  → BOTH platforms render the shared SearchResultConfidenceChip as
 *            `tier="estimated"` (never Verified — CLAUDE.md trust posture),
 *            unconditional now that `redesign_search_results` has collapsed
 *            permanently-on (ENG-1651), addressable via the shared
 *            `voice-confidence-chip` test hook.
 *   PHOTO  → NEITHER platform renders the chip (the 2026-05-01 range-first
 *            re-architecture dropped it). Guards against a future web-only
 *            addition silently diverging from mobile — the exact gap that made
 *            the ENG-1429 scoping report incomplete.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_VOICE_ITEM = resolve(
  __dirname,
  "../../src/app/components/suppr/voice-log-review-item.tsx",
);
const MOBILE_VOICE_ITEM = resolve(
  __dirname,
  "../../apps/mobile/components/AiLogReviewItem.tsx",
);
const WEB_PHOTO = resolve(
  __dirname,
  "../../src/app/components/suppr/photo-log-dialog.tsx",
);
const MOBILE_PHOTO = resolve(
  __dirname,
  "../../apps/mobile/components/PhotoLogSheet.tsx",
);

const WEB_VOICE_SRC = readFileSync(WEB_VOICE_ITEM, "utf8");
const MOBILE_VOICE_SRC = readFileSync(MOBILE_VOICE_ITEM, "utf8");
const WEB_PHOTO_SRC = readFileSync(WEB_PHOTO, "utf8");
const MOBILE_PHOTO_SRC = readFileSync(MOBILE_PHOTO, "utf8");

describe("ENG-1429 — voice AI-log review shows the chip on BOTH platforms", () => {
  it("web voice review row renders the shared chip as tier=estimated with the shared test hook, unconditionally", () => {
    expect(WEB_VOICE_SRC).not.toMatch(
      /isFeatureEnabled\(\s*["']redesign_search_results["']\s*\)/,
    );
    expect(WEB_VOICE_SRC).toMatch(/SearchResultConfidenceChip/);
    expect(WEB_VOICE_SRC).toMatch(/tier=["']estimated["']/);
    expect(WEB_VOICE_SRC).toMatch(/testId=["']voice-confidence-chip["']/);
  });

  it("mobile voice review row renders the same chip as estimated, unconditionally", () => {
    expect(MOBILE_VOICE_SRC).not.toMatch(
      /isFeatureEnabled\(\s*["']redesign_search_results["']\s*\)/,
    );
    expect(MOBILE_VOICE_SRC).toMatch(/SearchResultConfidenceChip/);
    expect(MOBILE_VOICE_SRC).toMatch(/tier=["']estimated["']/);
    expect(MOBILE_VOICE_SRC).toMatch(/testID=["']voice-confidence-chip["']/);
  });
});

describe("ENG-1429 — photo AI-log review shows NO chip on EITHER platform (parity-preserved)", () => {
  it("web photo dialog does not render the SearchResultConfidenceChip", () => {
    expect(WEB_PHOTO_SRC).not.toMatch(/SearchResultConfidenceChip/);
  });

  it("mobile photo sheet does not render the SearchResultConfidenceChip", () => {
    expect(MOBILE_PHOTO_SRC).not.toMatch(/SearchResultConfidenceChip/);
  });
});
