# Decision: Voice logging is Pro-only, server-enforced, 100 requests/day

**Date:** 2026-04-19

**Decision**
The voice-log API route (`app/api/nutrition/voice-log/route.ts`) now rejects any non-Pro tier with HTTP 403 and enforces a 100-request/day limit, closing a Base loophole that existed in the previous implementation.

**Prior state (superseded)**
Before 2026-04-19 the route blocked only `tier === "free"`, allowing Base users through with a 50/day limit. This matched neither the Pro-only claim on the landing page and all four client surfaces, nor the 100/day Pro rate limit. The discrepancy was recorded in `docs/research/voice-logging.md` (line 166 as of this writing) but was unresolved.

**Rationale**
All four client surfaces — web (`NutritionTracker.tsx`), mobile (`apps/mobile/app/(tabs)/index.tsx`, `voice-log-dialog.tsx`), Maestro E2E tests (`apps/mobile/.maestro/08_voice_log.yaml`), and product documentation — treated voice logging as a strictly Pro-only feature. The server was the only outlier. The mismatch created a gap: a Base user who called the API directly (or who was inadvertently routed to it via a client bug) could use a voice-logging feature they had not paid for, without the 100/day limit the Pro tier is entitled to. Aligning the server to Pro-only with `limit: 100` closes the gap, makes the billing contract correct at every layer, and removes the 50/day Base limit that had no documented rationale.

**Alternatives considered**
- Keep the Base tier on voice logging at a lower limit (e.g. 10/day) to reduce churn — rejected because no client surface, marketing claim, or documented decision ever promised voice logging to Base users; introducing a new Base entitlement without a product decision would be creating a de-facto tier benefit silently.
- Raise the Base limit to 100/day to match Pro and document Base as having voice logging — rejected because this would require updating the landing SSOT, pricing page, and all four client surfaces, representing a product decision (tier restructuring) that product-lead has not made.
- Leave the server-side loophole open and fix it "post-launch" — rejected because the voice-log endpoint calls OpenAI at ~$0.0003/request; a Base user could drive real cost and would not be correctly reflected in tier-based usage analytics.

**Platforms affected**
Both — server route affects web and mobile identically. Client-side gates were already correct; this decision aligns the server to match them.

**Agents involved**
executor (implementation), product-lead (implicit, via landing SSOT alignment), product-memory (capture).

**Implementation files**
- `app/api/nutrition/voice-log/route.ts` — tier check changed from `tier === "free"` to `tier !== "pro"`; rate limit changed from 50 to 100.
- Client gates (unchanged, already correct): `src/app/components/NutritionTracker.tsx`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/components/voice-log-dialog.tsx`.
- E2E test: `apps/mobile/.maestro/08_voice_log.yaml`.
- `src/lib/landing/content.ts` — SSOT listing voice logging as a Pro feature.

**Status**
Active. Supersedes the prior Base-loophole behaviour documented in `docs/research/voice-logging.md` lines 164–170.

**Revisit on**
- If voice logging is intentionally expanded to Base tier as a product decision: update the landing SSOT, pricing page, all client gates, and this entry simultaneously. Do not change the server route alone.
- If the 100/day Pro limit needs adjustment (cost change, usage data from PostHog): event to watch is `voice_log_submitted` segmented by `user_tier`.

**Related**
- `docs/research/voice-logging.md` — full research doc; lines 164–170 describe the prior (now superseded) server state.
- `src/lib/landing/content.ts` — SSOT; voice logging listed under Pro features.
- `docs/product/landing-maintenance.md` — `Known monetisation gaps` table documents the Base loophole closure under "Voice food logging".
- `docs/decisions/2026-04-full-sweep-ship-verdict.md` — tier-gate correctness was a named ship blocker (#1 Tier RLS); this decision closes a related gap on the voice-log route.
- `docs/decisions/2026-04-19-shopping-list-tier-gating.md` — companion decision from same sweep (tier gating, different resolution).
- `docs/decisions/2026-04-19-renewal-disclosure-rewrite.md` — companion decision from same sweep.
