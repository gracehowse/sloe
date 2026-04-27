# Legal finalization — runbook

**Owner:** Grace
**Status:** required before public launch (UK + EU + App Store)
**Last updated:** 2026-04-25 (P1-15 of [Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md))

This is the operational sequence for closing the four legal workstreams that gate public launch. Soft TestFlight does NOT need all of these resolved (the existing PLACEHOLDER strings are tolerable for a closed beta with internal users), but App Store submission and any UK/EU public availability does.

The decisions live in `docs/decisions/`; this runbook is the **execution sequence** that translates those decisions into shipped legal copy + filed registrations.

---

## Sequence at a glance

```
[1] Cayman immigration counsel       (gates everything below)
        ↓
[2] Trademark direction — TM-1       (parallel to #1)
        ↓
[3] US cross-border CPA              (depends on #1 returning yes)
        ↓
[4] Form Delaware LLC via Stripe Atlas
        ↓
[5] Stripe onboarding
        ↓
[6] Update privacy/terms/dmca/licences (kill 5 PLACEHOLDERs)
        ↓
[7] Register DMCA designated agent
        ↓
[8] Appoint UK + EU GDPR Article 27 representatives
        ↓
[9] Vendor DPAs
        ↓
[10] Re-run prelaunch:checklist; legal section all green
```

Each step has a paired decision doc (linked below). Update the decision doc as the step closes.

---

## 1. Cayman immigration counsel

**Why it gates everything:** Grace is on a dependant work permit in Cayman. If immigration counsel says a dependant cannot legally own / direct a foreign company while resident in Cayman, the entire jurisdiction choice changes (or the timeline shifts to "wait for own permit").

**Action:** book the 30-minute call scoped in [`docs/decisions/2026-04-20-incorporation-jurisdiction-pending.md`](../decisions/2026-04-20-incorporation-jurisdiction-pending.md) §"Cayman immigration counsel". Specifically ask:

1. Can a dependant-status spouse own 100% of a foreign-incorporated company?
2. Can she serve as sole director?
3. Can she receive income (salary / dividend / management fee / distribution) into a personal Cayman bank account?
4. Does any of the above jeopardise her husband's work permit?

**Cost:** USD 0–200 (often free via husband's employer's HR / sponsor's immigration contact).

**Output:** plain-English yes/no + caveats. Update the decision doc with the answer.

## 2. Trademark direction (TM-1)

**Why it parallels #1:** if a forced rebrand is coming, don't pay formation fees on the current name twice. Tracked in [`docs/planning/ip-followups-2026-04-19.md`](../planning/ip-followups-2026-04-19.md). Memory flags "Suppr / Suppr Club HIGH" risk vs the live "Supper Club!" App Store competitor + phonetic-equivalence problem.

**Action:** complete TM-1 ("Suppr / Suppr Club" trademark search + counsel review) before incorporation. Either:

- Resolve direction (keep / rebrand / alternate brand) **before** #4, OR
- Accept that the entity's name can be changed post-incorporation cheaply (true but distracting) and incorporate anyway.

**Decision doc:** create `docs/decisions/<date>-trademark-direction.md` when resolved.

## 3. US cross-border CPA — Delaware LLC path

**Action:** book a 60-minute paid consult **after** #1 returns yes. Scope in the incorporation pending doc §"US cross-border CPA". Specifically confirm:

1. Grace's fact pattern (UK citizen, Cayman-resident, no US ties, Stripe-billed consumer SaaS, no US employees / offices / inventory) supports the "no ECI → no US federal income tax at the LLC level" assumption.
2. Annual Form 5472 + pro-forma Form 1120 filing fee (target USD 400–800/yr).
3. Thresholds that would trigger US nexus / ECI as Suppr scales (first US contractor, hosted region choices, US office).
4. No UK or Cayman tax side-effects.

**Cost:** USD 300–600 + brief written follow-up.

**Vendors:** James Baker CPA, 1040 Abroad, Greenback, several solo CPAs with non-US-founder LLC practice. Short-list 2–3 before booking.

## 4. Form Delaware LLC via Stripe Atlas

**Cost:** USD 250 (50% Founders Hub discount; nominal USD 500). Apply discount at signup; verify it lands before paying.

**EIN:** Form SS-4 for non-US founder; arrives 1–3 weeks post-filing. Mercury bank opens in parallel.

**When complete:** flip the incorporation decision doc `Status:` from `open` to `resolved`. Create sibling `docs/decisions/<date>-incorporation-decided.md` capturing the actual entity name, registered office, EIN issuance date.

## 5. Stripe onboarding

Stripe does **not** support Cayman as a merchant jurisdiction — entity must exist first. Activate the USD 2,500 Founders Hub processing credits perk during onboarding.

## 6. Update privacy / terms / dmca / licences pages

Five `[PLACEHOLDER ...]` strings are committed in the legal pages. The prelaunch checklist (P1-15, 2026-04-25) inventories them on every run. Once #4 returns the entity name + registered office, kill all five:

| File | Line | Placeholder | Replace with |
|---|---|---|---|
| `app/privacy/page.tsx` | 27 | Controller | `Suppr operates as <ENTITY NAME>, <REGISTERED OFFICE>` |
| `app/privacy/page.tsx` | 38 | UK Representative | Once Article 27 rep is appointed (step 8) — name + UK postal address + contact email |
| `app/privacy/page.tsx` | 42 | EU Representative | Same — Article 27 rep details |
| `app/terms/page.tsx` | 165 | Liability cap | Replace with the actual liability-cap copy your counsel provides under your jurisdiction's consumer-law constraints |
| `app/terms/page.tsx` | 175 | Governing law | Replace with the entity's governing-law clause (Delaware / UK / etc.) |

Run `npm run prelaunch:checklist` after each replacement; the legal-pages section should drop the count by one until it's zero.

## 7. Register DMCA designated agent

**Why:** Section 512(c) safe harbour requires a registered DMCA agent. Without it, Suppr loses the safe harbour for any user-generated content (recipes, photos, comments).

**Action:** Register at [https://www.copyright.gov/dmca-directory/](https://www.copyright.gov/dmca-directory/). Cost USD 6 (one-time) + USD 6 every 3 years to maintain.

The current `app/dmca/page.tsx` references a default DMCA email; once registration is complete, surface the registered agent details there. Tracked as DMCA-1 in `TODO.md`.

## 8. UK + EU GDPR Article 27 representatives

**Why:** required if you offer services to data subjects in those regions and the entity is established outside them. Delaware LLC = outside both. UK Ltd would still need EU rep.

**Action:** appoint a representative in each region. Off-the-shelf services charge GBP 200–500/yr (UK) and EUR 200–500/yr (EU). Vendors: Prighter, EDPO, Articulus.

When appointed, replace the placeholders at `app/privacy/page.tsx:38` and `app/privacy/page.tsx:42`.

**Decision doc:** create `docs/decisions/<date>-gdpr-article-27-reps.md` with the chosen vendors + costs.

## 9. Vendor DPAs

Sign a Data Processing Agreement with each subprocessor handling user data:

- Supabase (sign DPA via dashboard → Org Settings → Legal)
- Stripe (auto-applied via terms; record in `docs/legal/dpa-inventory.md`)
- RevenueCat (signable via dashboard)
- Expo (signable via EAS dashboard)
- PostHog (auto-applied; record)
- Sentry (auto-applied; record)
- OpenAI (DPA via API platform)
- Edamam (signable via Edamam dashboard)
- FatSecret (review tier-specific terms; per the 2026-04-25 fatsecret-tier-confirmation decision the Basic-tier compliance wording belongs on the licences page — TODO P1-18)

Track signed-vs-pending in a Notion row per vendor under "Vendors & subscriptions".

## 10. Re-run prelaunch:checklist

```bash
npm run prelaunch:checklist
```

The "Legal page placeholders" section should report 0 unresolved. The RC webhook idempotency smoke (P1-14) should be green. Migration drift should be clean. At that point the legal workstream is closed for launch.

---

## Costs summary

| Item | Cost (one-off) | Cost (annual) |
|---|---|---|
| Cayman immigration counsel | USD 0–200 | — |
| US CPA consult | USD 300–600 | USD 400–800 (5472 filing) |
| Stripe Atlas formation | USD 250 (after Founders Hub discount) | — |
| Mercury bank | USD 0 | — |
| DMCA designated agent | USD 6 | USD 2/yr (USD 6 every 3 years) |
| UK Article 27 rep | — | GBP 200–500 |
| EU Article 27 rep | — | EUR 200–500 |
| **Estimated launch-floor total** | **~USD 700–1,100** | **~USD 800–1,500** |

## What this runbook is NOT

This is an execution sequence written from the maintainer's perspective. It does not constitute legal advice. Every decision in steps 1–9 needs a qualified advisor's confirmation against Grace's actual fact pattern, jurisdiction, and risk tolerance. The runbook lists the conversations to have, not the conclusions to draw.

## Related artefacts

- [Incorporation jurisdiction (pending advisor input)](../decisions/2026-04-20-incorporation-jurisdiction-pending.md)
- [Consumer VAT posture (UK + EU)](../decisions/2026-04-19-consumer-vat-posture-uk-eu.md)
- [IP follow-ups](../planning/ip-followups-2026-04-19.md)
- [TODO.md — LEGAL-1, DMCA-1](../../TODO.md)
- [P1-14 RevenueCat replay smoke](../decisions/2026-04-25-revenuecat-replay-smoke.md) — sister item in `prelaunch:checklist`.

## Revisit when

- Cayman immigration counsel returns. Update incorporation pending doc.
- TM-1 resolves. Update planning doc.
- CPA consult returns. Update incorporation pending doc.
- Atlas formation completes. Flip incorporation pending doc to resolved + create -decided sibling.
- Any placeholder count goes back up (e.g. a future migration adds new legal copy with PLACEHOLDERs). Run the prelaunch checklist.
