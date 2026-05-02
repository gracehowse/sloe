/**
 * Cook handsfree v2 — feature-flag default (2026-05-02).
 *
 * Pins that `COOK_HANDSFREE_FEATURE_ENABLED` is `false` at merge time.
 * If a future commit flips it without going through the release
 * checklist (decision-doc update, screenshot review, analytics
 * instrumentation review) this test fails as a tripwire.
 *
 * The flag IS allowed to be `true` — but only when the matching commit
 * also updates `docs/decisions/2026-05-01-cook-voice-handsfree.md` to
 * record the flip and the date. Update this expectation in lockstep.
 */
import { describe, expect, it } from "vitest";

import {
  COOK_HANDSFREE_FEATURE_ENABLED,
  COOK_HANDSFREE_CONSENT_KEY,
  COOK_HANDSFREE_HINT_SEEN_KEY,
  COOK_HANDSFREE_ENABLED_KEY,
} from "../../lib/cookHandsfree";

describe("cook handsfree v2 feature flag (dark default)", () => {
  it("is dark by default", () => {
    expect(COOK_HANDSFREE_FEATURE_ENABLED).toBe(false);
  });

  it("exposes the v2 storage keys with stable names", () => {
    // Stable keys are how we honour the decision doc's "user opt-in
    // persists across app updates" rule. If we rename a key without
    // a migration, returning users get re-prompted with the consent
    // sheet — annoying, not catastrophic, but worth pinning.
    expect(COOK_HANDSFREE_ENABLED_KEY).toBe("suppr.cook.handsfree.enabled");
    expect(COOK_HANDSFREE_CONSENT_KEY).toBe("suppr.cook.handsfree.consent_v1");
    expect(COOK_HANDSFREE_HINT_SEEN_KEY).toBe("suppr.cook.handsfree.hint_seen");
  });
});
