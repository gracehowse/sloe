# Decision log: legal finalization runbook + placeholder lint (P1-15, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved (deliverables shipped); legal workstreams remain open until Grace executes the runbook
**Trigger:** P1 #15 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit said "incorporation pending; 3 PLACEHOLDERs in privacy page; DMCA agent unregistered; UK + EU GDPR reps unappointed."

---

## Decision

I cannot make Grace's legal decisions (jurisdiction, brand, advisor selection) — those are her calls with her advisors. What I shipped is the **execution scaffold** that makes the decisions trivial to translate into shipped code:

1. **Comprehensive runbook** at `docs/operations/legal-finalization-runbook.md`. Ten-step sequence: Cayman immigration counsel → trademark direction → US CPA → Atlas formation → Stripe onboarding → kill 5 placeholders → DMCA registration → Article 27 reps → vendor DPAs → re-run prelaunch:checklist. Each step has cost estimate, vendor short-list, exact file:line targets for the placeholders, and the decision doc it updates.
2. **Placeholder inventory in prelaunch:checklist**. New "Legal page placeholders (P1-15)" section walks `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/dmca/page.tsx`, `app/licences/page.tsx`; reports total count + per-file line numbers for any `[PLACEHOLDER ...]` strings still committed. Today: **5 unresolved** (3 privacy + 2 terms; the audit said 3, missed 2).
3. **Audit correction**. The audit mentioned 3 placeholders in privacy; the actual count is 5 across two files. Updated the runbook accordingly.

What's NOT shipped: the actual legal copy, because there's no entity name yet. Once Grace runs the runbook through step 4 (Atlas formation completes), I can do step 6 (replace the 5 placeholders) in <30 minutes.

## Rationale

The 5 placeholders are not bugs — they're deliberate acknowledgements that the entity decision is upstream. Shipping them un-flagged would be the bug. The lint in `prelaunch:checklist` makes the count visible at every prelaunch run, so the day Grace closes #4 in the runbook, she sees 5 → 0 in the checklist output as proof the legal workstream is done.

Grace runs the runbook. I make the code change. The split keeps the legal calls in human hands and the file edits in a fast iteration.

## Alternatives considered

- **Build a static-site-generator step that pulls entity name from a config and renders the legal pages.** Rejected for the launch window. Adds infrastructure to solve a 5-line edit. Once entity is set, the placeholders get a hand-replace in one PR; no need for a config layer.
- **Fail prelaunch:checklist on placeholders > 0 (strict mode).** Rejected. The checklist is informational by design; same shape as the migration drift section. Strict mode would block soft-TestFlight uses where the placeholders are genuinely tolerable.
- **Auto-replace placeholders from env vars at build time.** Rejected. Privacy/legal copy is high-stakes; mixing build-time substitution with hand-reviewed legal text invites silent errors. The hand-replace step is the audit trail — counsel can review the diff.

## Implementation

- `docs/operations/legal-finalization-runbook.md` — new. Ten-step sequence, cost summary table, vendor short-lists, exact file:line targets for the five placeholders, audit correction, "what this is NOT" disclaimer.
- `scripts/prelaunch-checklist.ts` — new "Legal page placeholders (P1-15)" section between migration drift and the RevenueCat replay smoke. Walks four legal page files, reports total count + per-file line numbers.

Verified locally: prelaunch checklist output reports `[!!] 5 unresolved [PLACEHOLDER ...] in legal pages — see docs/operations/legal-finalization-runbook.md` with the exact file:line breakdown (privacy:27, 38, 42; terms:165, 175).

## Platforms affected

- **Ops (Grace):** new runbook + new prelaunch checklist section. No change to user-facing surfaces.
- **Web / Mobile / Supabase:** none.

## Verification

- Prelaunch checklist runs cleanly (exit 0, since placeholders are informational); the "Legal page placeholders" section reports 5 unresolved with exact line numbers.
- Lines match a manual `grep -nE "PLACEHOLDER" app/{privacy,terms,dmca,licences}/page.tsx`.

## Related artefacts

- [Runbook](../operations/legal-finalization-runbook.md)
- [Incorporation jurisdiction (pending advisor input)](./2026-04-20-incorporation-jurisdiction-pending.md)
- [Consumer VAT posture (UK + EU)](./2026-04-19-consumer-vat-posture-uk-eu.md)
- [IP follow-ups](../planning/ip-followups-2026-04-19.md)
- TODO.md — `LEGAL-1`, `DMCA-1`

## Revisit when

- Atlas formation completes — replace the 5 placeholders in one PR; the prelaunch checklist count drops to 0.
- New legal pages are added (e.g. cookies policy, EULA) — extend the prelaunch lint's `legalFiles` array to include them.
- A future migration adds new PLACEHOLDER strings outside the four legal pages — broaden the scan or make the audit a pre-commit hook.
