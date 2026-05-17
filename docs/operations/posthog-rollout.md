# PostHog rollout runbook

Operator playbook for the PostHog feature flags Suppr owns and the
specific dashboard moves required at each phase of the product rollout.

This is a working runbook — not a decision doc. Decisions for each
flag live alongside the code that introduced them in
`docs/decisions/`. Update this file when a flag is added, ramped, or
retired.

## Active flags

### `session-replay-sample-rate` (ENG-516)

| Property | Value |
| --- | --- |
| Flag ID | 679616 |
| Type | Boolean (with numeric payload) |
| URL | https://us.posthog.com/project/389168/feature_flags/679616 |
| Owner | Grace |
| Decision doc | [2026-05-16-session-replay-sample-rate-flag](../decisions/2026-05-16-session-replay-sample-rate-flag.md) |

Drives the session-replay sample rate on web + mobile. Boolean `true`
at 100%; the numeric payload is the per-session sample rate (0.0 - 1.0).

#### Ramp schedule

| Phase | Date | Payload | Why |
| --- | --- | --- | --- |
| Pre-launch (today) | 2026-05-16 → Phase 1 launch | `"1.0"` | N=1 (Grace). Every TF/web bug report is a replayable session. Storage cost trivial. |
| Day-of Phase 1 launch | Day TF + web open to real users | `"0.1"` | First viral surge could push 1k+ sessions/day; full capture blows the PostHog free tier (5k recordings/month). 10% gives a representative sample without runaway cost. |
| Steady state | Week 4+ of Phase 1 | `"0.05"` or `"0.02"` | Adjust based on actual storage consumption + which sessions we're using. If we're only watching crash-tagged sessions, sample low + use replay filters. |
| Incident response | When needed | `"1.0"` | Temporary flip to capture every session for debugging an outage. Don't forget to flip back. |

#### How to ramp

1. Open https://us.posthog.com/project/389168/feature_flags/679616
2. Edit the flag.
3. Under "Payload", change the `true` variant's value (e.g. from
   `"1.0"` to `"0.1"`). Keep it a JSON-quoted number string.
4. Save.

Takes effect on each user's next session (typically within 24h for
active users). The current session's recording isn't affected because
PostHog decides sampling once at recording-start.

#### Kill switch

To temporarily disable session replay entirely (e.g. a privacy
incident or storage emergency):

- Option A — Flag payload to `"0"`. The SDK won't start any new
  recordings. Reversible without a deploy. Takes effect on each user's
  next session.
- Option B — At the PostHog project level, toggle "Enable session
  recording" off. Immediate effect on all users. Reversible from the
  same toggle.

Option B is faster (no per-user lag). Use it for incidents. Use the
flag payload approach for everyday rate adjustments.

#### Volume sanity check (rough)

PostHog free tier: 5,000 recordings/month.

| Daily sessions | Sample 1.0 | Sample 0.1 | Sample 0.01 |
| --- | --- | --- | --- |
| 100 | 3,000/mo ✅ | 300/mo ✅ | 30/mo ✅ |
| 500 | 15,000/mo ❌ | 1,500/mo ✅ | 150/mo ✅ |
| 1,000 | 30,000/mo ❌ | 3,000/mo ✅ | 300/mo ✅ |
| 5,000 | 150,000/mo ❌ | 15,000/mo ❌ | 1,500/mo ✅ |

So:
- Below ~150 daily sessions → 1.0 is fine.
- 150 - 1,500 daily sessions → 0.1 is the sweet spot.
- Above ~1,500 daily sessions → 0.01 or move off free tier.

Refine these numbers once we have actual traffic. They're back-of-
envelope estimates assuming 30 days/month.

## Retired flags

(none yet)

## Flag hygiene rules

- Every active flag has a decision doc in `docs/decisions/` linked from
  the table above.
- Every active flag has a named owner.
- Flags that have held 100% for two weeks with no regression are
  candidates for code-side cleanup (remove the gate, leave the flag
  for emergency kill-switch use if applicable).
- Flags retired permanently get archived in PostHog AND moved to the
  "Retired flags" section above with the retirement date.
