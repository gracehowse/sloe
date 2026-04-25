# Decision log: UK/EU 14-day statutory cancellation framing (2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — path (a) shipped without counsel; path (b) deferred to counsel review
**Owner:** `legal-reviewer` (recommendation), `executor` + `monetisation-architect` (implementation)

Closes item E from the [2026-04-25 paywall dark-pattern audit](./2026-04-25-paywall-dark-pattern-audit.md).

---

## Decision

**Ship path (a): surface the 14-day statutory right alongside the existing 7-day goodwill policy.** Region-aware on web via the existing `detectRegion(headers)` helper. Same string family across all three billing surfaces.

**Reject path (b): explicit waiver collection at checkout.** It is the legally cleaner option *if executed perfectly*, but the waiver flow must be (i) express, (ii) acknowledged (consumer must positively confirm they lose the right), and (iii) recorded on the durable medium / order confirmation email. A bare button-label change ("Subscribe & waive my 14-day right") almost certainly fails the "express consent + acknowledgement" test under Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (SI 2013/3134) reg. 37(1)(a)–(b). A checkbox in front of Subscribe would work but adds friction at the worst possible moment, and CMA enforcement on subscription dark patterns has been active since 2024. **Path (b) is counsel-grade work.**

---

## Why path (a) is shippable today

- N=1 tester. Financial exposure of honouring the 14-day right is zero today; near-zero through low-thousand-customer scale.
- We are advertising rights the consumer already has by law. Zero new exposure.
- The 7-day goodwill policy still differentiates (faster, lower-friction email path).
- Conservative posture pre-incorporation: do not extinguish statutory rights when we don't have to.

---

## Copy to ship

### `apps/mobile/app/paywall.tsx` (~540, all regions — mobile can't reliably pre-detect store region)

```
Auto-renews until cancelled in Settings → Apple ID → Subscriptions
(or Google Play). Refunds are handled by Apple / Google.

UK & EU customers: you have a statutory 14-day right to cancel
distance contracts. Beyond that, we offer a 7-day goodwill refund —
email support@suppr.club.
```

### `app/pricing/PricingTiersGrid.tsx` BillingDisclosure (~346, region-aware)

**UK / EU branch:**

```
Auto-renews monthly/annually until cancelled. Cancel anytime in
Account → Billing; cancellation takes effect at period end.

Your 14-day right to cancel: under UK Consumer Contracts Regulations
2013 / EU Directive 2011/83 you may cancel within 14 days of
purchase for a full refund. Beyond that we offer a 7-day goodwill
refund — email support@suppr.club.

Prices include VAT.
```

**Rest of world branch:**

```
Auto-renews monthly/annually until cancelled. Cancel anytime in
Account → Billing; cancellation takes effect at period end.
7-day goodwill refund policy — email support@suppr.club.
```

### `src/app/components/suppr/upgrade-paywall-dialog.tsx` (T24 CMA-shape extension)

```
You'll be charged {price} {today/on {trial-end-date}}, then
{price}/{period} until cancelled. Cancel anytime in Account → Billing.
{UK/EU only:} 14-day statutory right to cancel applies. {All regions:}
7-day goodwill refund — support@suppr.club.
```

---

## Region detection

**Web:** use `detectRegion(headers)` (already wired for VAT). Same surface that decides VAT-inclusive pricing decides cancellation-rights language. Showing UK/EU language to a US visitor wrongly implies UK statutory rights — that's the actively harmful direction.

**Mobile:** **don't** region-detect. Paywall renders before purchase region is known and Apple/Google handle store-region anyway. Show the combined disclosure to everyone — it's accurate for UK/EU and informational-only for others.

**Trade-off accepted:** a UK visitor on a US VPN sees the wrong disclosure on web. Same failure mode as VAT.

---

## Domain note

Copy above uses `support@suppr.club` as the support email. **Final email follows the [domain canonicalisation decision](./2026-04-25-domain-and-suppr-club-rename.md) — replace at sweep time.** If T17 has shipped before this PR, use `support@supprclub.com`; otherwise place a `// DOMAIN: replace post-T17` marker so the codebase grep stays clean.

---

## What still needs counsel

- **Waiver-collection flow** (path b) if/when Suppr wants to extinguish the 14-day right at checkout.
- **Consumer arbitration / dispute venue clauses** in ToS — irrelevant pre-incorporation but blocking before public EU launch.
- **Statutory damages exposure for past sales** — N=1, moot.
- **Refund-mechanism mismatch on mobile** — Apple controls the refund; if a UK customer asserts their 14-day right and Apple declines, who bears the cost? Counsel should confirm Suppr top-up obligation.
- **"Goodwill" framing legality** — overlapping a 7-day goodwill refund on top of a 14-day statutory right is fine; counsel should confirm the labels don't mislead.

---

## Related

- [2026-04-25 paywall dark-pattern audit](./2026-04-25-paywall-dark-pattern-audit.md) — closes item E
- [2026-04-19 consumer VAT posture (UK + EU)](./2026-04-19-consumer-vat-posture-uk-eu.md) — same region-detection plumbing
- [2026-04-19 renewal disclosure rewrite](./2026-04-19-renewal-disclosure-rewrite.md) — earlier disclosure work
- [2026-04-25 domain + Suppr Club rename](./2026-04-25-domain-and-suppr-club-rename.md) — owns the support email surface
