# Incorporation — work-from checklist

**Owner:** Grace · **Status:** not started (as of 2026-07-02) · **Type:** founder ops, engaged when the app is launch-ready (not a build blocker — see `feedback_legal_never_blocks_the_build` / Grace 2026-07-02).

This is the **do-this** checklist. The **why** — jurisdiction rationale, Grace's fact
pattern, advisor scopes, tax reasoning — lives in
`docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`. Don't
re-research; work the steps.

**Current-preferred path:** Delaware single-member LLC via **Stripe Atlas**
(UK Ltd is the fallback if immigration or the CPA knock Delaware out).

**Why it matters downstream (all wait on the entity existing):**
- Stripe billing — Stripe doesn't support Cayman as a merchant jurisdiction, so **no entity → no revenue**.
- DMCA designated-agent filing (`docs/operations/eng-859-dmca-filing-checklist.md`) — needs the entity legal name + registered address.
- Legal copy — entity name across terms / privacy / dmca / licences / footer + vendor DPAs.

## Steps (in order — do NOT reorder; each gates the next)

1. [ ] **Cayman immigration call (do this FIRST).** ~1–3 days, free via sponsor HR else ~$200.
   Ask: can a dependant-status spouse (a) own 100% of a foreign-incorporated company, (b) serve as sole director, (c) receive income/distributions into a personal Cayman account — and does any of it jeopardise the husband's work permit? Output: a plain yes/no + caveats the CPA keys off. **A "no" or "yes-with-caveats" changes every option below.**
2. [ ] **Trademark direction resolved (concurrent with #1).** Don't pay formation fees on a name that's about to change — the Sloe rebrand should be settled first (`project_rebrand_checklist`, TM-1). Entity name can be changed post-incorporation cheaply, but avoid the churn.
3. [ ] **US cross-border CPA consult** (book only after #1 returns a clean yes). ~$300–600, 3–5 days.
   Confirm the load-bearing "no US ECI → 0% US federal tax at the LLC level" assumption against Grace's facts; quote the annual Form 5472 service fee (target $400–800/yr — second opinion if materially higher); map what future events trigger US nexus (first US contractor, US-region hosting, US office/inventory).
4. [ ] **Form the Delaware LLC via Stripe Atlas** (after #3 clears). ~$250 (50% Founders Hub discount — verify it lands before paying), EIN in 1–3 weeks, Mercury bank in parallel. **Activate the $2,500 Stripe processing-credits perk during onboarding.**
5. [ ] **Onboard Stripe** against the new Atlas LLC (1–2 days after #4).
6. [ ] **File the DMCA designated agent** — now unblocked; entity name + registered address exist. Use `docs/operations/eng-859-dmca-filing-checklist.md` (fill-ready sheet). Set `DMCA_AGENT_REG_NUMBER` in prod to clear the prelaunch launch gate.
7. [ ] **Legal-copy pass** — entity name + registered office into terms / privacy / dmca / licences / footer, resolve the `[PLACEHOLDER …]` tokens the prelaunch checklist scans for, refresh vendor DPAs (Stripe, Supabase, RevenueCat, Expo, PostHog, Sentry, OpenAI, Edamam).

## Fallback trigger

If #1 (immigration) or #3 (CPA) returns a blocker that knocks out Delaware, switch to a
**UK chartered tax advisor** to re-evaluate **UK Ltd** (Companies House, same-week
formation, first-class Stripe support; ~£400–800 advisor). See the decision doc § 2b.

## Perks to actually use (Microsoft for Startups Founders Hub, enrolled 2026-04-20)

- Stripe Atlas 50% off ($500 → $250) — applied at Atlas signup (#4).
- Stripe $2,500 processing credits — activate during Stripe onboarding (#5); expires, use it.
- Azure $5k+ credits — not needed for the current Vercel+Supabase stack; track expiry, don't depend on it.

## References

- `docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md` — full rationale + advisor scopes (source of truth).
- `docs/planning/ip-followups-2026-04-19.md` — IP clearance actions (DMCA, incorporation, TM-1) as P0.
- `docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md` — UK/EU consumer VAT applies regardless of entity choice (not a jurisdiction variable).
