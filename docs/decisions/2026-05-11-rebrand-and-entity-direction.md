# Rebrand initiation + entity jurisdiction

**Date:** 2026-05-11
**Status:** Open
**Area:** Brand / legal / entity
**Driver:** Grace (TF feedback session — rebrand now, lock entity)

## A4 — Rebrand: REBRAND NOW

Trademark scan flagged HIGH risk on "Suppr" / "Suppr Club" (2026-04-19,
see `project_trademark_risk.md` memory): live App Store competitor
"Supper Club!" + phonetic-equivalence problem. Grace's call (today):
**rebrand before App Store first-public release**, not after.

### Workflow
1. Brainstorm — generate verified candidates (`.com` available + zero
   exact-name App Store apps + zero live USPTO regs). Done by
   `brand-manager` and `general-purpose` agents with live WebFetch
   gates. **Reject any candidate failing any gate.**
2. Grace picks finalist (and a fallback).
3. £200-400 paid clearance opinion from a TM attorney on the finalist
   in classes 9 / 35 / 41 / 42 (relevant tech / health-info classes).
4. Register `.com` on the day of selection.
5. Sweep repo + external systems (GitHub, Vercel, Sentry, PostHog,
   Stripe, App Store Connect, RevenueCat, push templates).

### Candidate set 1 (2026-05-11 morning)
Round 1 produced: Larder, Hearth, Mise, Tally, Nook, Ledger.
**REJECTED by Grace** — "not actually clear on the app store or from
a domain perspective." All had soft conflicts.

### Candidate set 2 (2026-05-11 afternoon — strict)
Round 2 (general-purpose agent with WebFetch + WebSearch) produced
5 verified candidates within 3–7 letters:

| # | Name | Vibe | Status |
|---|---|---|---|
| 1 | Leorna | 5/5 | Cleanest — no oat conflict, no real-world denotation |
| 2 | Oatfern | 4/5 | Oatly opposition risk |
| 3 | Oatglen | 4/5 | Oatly opposition risk |
| 4 | Oatwise | 3/5 | EatWise/Eatwise AI confusion risk + Oatly |
| 5 | Oatcove | 4/5 | Oatly opposition risk |

Four of five lead with `oat-` because pronounceable 4-6-letter `.com`s
are essentially extinct. Oatly (oatly.com / Oatly AB) has a documented
record of opposing oat-prefix marks in food/beverage. Risk lower in
class 9/42 than 29/30, but non-zero.

Grace's call: **get more non-oat options at 8 letters**. Round 3 in
progress.

## A2 — Entity jurisdiction: Delaware LLC via Stripe Atlas

**Resolved.** Decision tree from `project_incorporation_sequencing.md`:

- Cayman Islands (where Grace resides) → no in-jurisdiction VAT on
  Suppr's own income (see `project_tax_jurisdiction.md`), but consumer
  VAT on UK/EU sales applies regardless (see
  `2026-04-19-consumer-vat-posture-uk-eu.md`).
- US Delaware LLC → Stripe Atlas does the formation (~$500) + opens a
  US bank account + provides registered-agent service for year one.
  Cleanest path to App Store payments + Stripe + US tax compliance.
- UK Ltd remains the fallback if Delaware blocks Grace's residency
  status / cross-border CPA can't sign off.

### Contingent on
1. Cayman immigration sign-off — Grace must check whether forming a
   foreign entity affects her current immigration status.
2. US cross-border CPA — needs a US/Cayman/UK-aware tax opinion
   confirming the LLC pass-through works without creating a US tax
   residency issue for Grace personally.

### Status
- Will not block on these — **Stripe Atlas formation is queued for
  the same week Grace picks the rebrand name**, so the entity gets
  formed under the new name (avoids a costly rename later).
- Tracker: `docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`

## A5 / A6 — Bank + accounting

**Deferred until after entity formation.** Cannot open business bank
or onboard accounting software without a registered entity. Logged
as blocked-on-A2.

## A8 — Tester cohort

**N=1 until rebrand ships.** Grace is the only TestFlight tester.
Scope cohort risk to one user; don't over-engineer for users who
don't exist yet. Re-evaluate post-rebrand + post-A2.

## Notion mirror

Will mirror to Notion **once Grace picks the rebrand finalist** —
currently brainstorm-stage, not a resolved decision.
