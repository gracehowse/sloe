# Income projection — Suppr

**Last refresh:** 2026-06-18
**Source of truth for finance:** Linear doc [**Suppr Ops — vendors & runway**](https://linear.app/suppr/document/suppr-ops-vendors-and-runway-8f0de8bd5070) (burn) + this file (revenue model). Notion retired 2026-06-18.
**Currency basis:** **GBP for burn** (Revolut/card export). **USD for vendor invoice amounts** (Claude, Cursor, etc. charge in USD; they land on the card in GBP at statement FX). Do not convert peak GBP burn back to USD for planning — that double-counts FX.

---

## Why this exists

The previous projection (Notion → Operations & finance, 2026-04-20) used **headline pricing** as revenue per sub. That is the single biggest error in any consumer-SaaS model: it ignores VAT (20% UK/EU, inclusive) and platform fees (Stripe ~3%, Apple 15% with SBP / 30% without). The 2026-04-20 model was **~53% optimistic** on break-even at headline pricing (55 subs vs ~84 at Apr burn). **As of Jun 2026, planning burn is ~£388/mo (card) → ~124 subs** at blended net £3.14/sub.

---

## Inputs (validate before relying on these)

| Input | Value | Source / status |
|---|---|---|
| Pricing | Pro £7.99/mo, £59.99/yr; Base £3.99/mo, £29.99/yr; Free £0 | `docs/decisions/2026-04-19-pricing-v1.md` |
| VAT | 20% UK, inclusive; EU varies but inclusive throughout | `docs/decisions/2026-04-19-consumer-vat-posture-uk-eu.md` |
| Stripe fees | 2.9% + £0.20 per UK card transaction | Stripe published rate |
| Apple commission | 15% under Small Business Program (SBP); 30% standard year-1; 15% year-2+ same sub | Apple Developer terms |
| **Apple SBP enrolment** | **OPEN — confirm in App Store Connect → Agreements, Tax, Banking** | If lapsed, mobile net drops ~14% per sub |
| **Monthly burn (planning)** | **~£388/mo card** (~**£395/mo all-in**) | Revolut peak period 15 May–16 Jun; add ~£6.50/mo Apple $99 (other card, paid 13 Apr) |
| Monthly burn (legacy) | ~£262/mo (~$334 USD Apr Notion snapshot) | Superseded — pre Revolut export refresh |
| Burn composition (YTD invoices) | **53% Claude · 31% Cursor · 6% OpenAI · 5% Supabase · 5% other** | Claude + Cursor = **~84%**; Supabase cancelled Apr 2026 |
| Platform mix assumption | 60% mobile / 40% web | Unvalidated — revisit after 90d |
| Billing-period mix | Mobile: 60% annual / 40% monthly (annual is default). Web: 70% monthly / 30% annual (monthly is default) | `docs/decisions/2026-04-19-pricing-default-billing-period-divergence.md` |
| Tier mix | 70% Base / 30% Pro | Conservative; consumer SaaS norm |
| Churn (gross) | 8%/mo pre-PMF; revise to 5%/mo once habit loop confirmed | Industry benchmark (consumer fitness) |
| Conversion (Free → Paid) | 1.5% slow / 3% base / 4% MFP-capture | 2–5% consumer-SaaS benchmark |

---

## Net revenue per sub (after VAT + platform fees)

Apple SBP assumed enrolled throughout. All "ex-VAT" = headline ÷ 1.2.

| SKU | Headline | Ex-VAT | Web net (Stripe) | Mobile net (Apple SBP) |
|---|---|---|---|---|
| Pro monthly | £7.99/mo | £6.66 | **£6.23/mo** | **£5.66/mo** |
| Pro annual | £59.99/yr | £49.99 | **£48.05/yr** = £4.00/mo eff. | **£42.49/yr** = £3.54/mo eff. |
| Base monthly | £3.99/mo | £3.33 | **£3.01/mo** | **£2.83/mo** |
| Base annual | £29.99/yr | £24.99 | **£23.92/yr** = £1.99/mo eff. | **£21.24/yr** = £1.77/mo eff. |

### Blended net per sub

Weights: (mobile 60% × annual 60% + mobile 60% × monthly 40% + web 40% × monthly 70% + web 40% × annual 30%).

- **Pro weighted net:** £4.86/mo (= 3.54×0.36 + 5.66×0.24 + 6.23×0.28 + 4.00×0.12)
- **Base weighted net:** £2.40/mo (= 1.77×0.36 + 2.83×0.24 + 3.01×0.28 + 1.99×0.12)
- **Blended (70% Base / 30% Pro):** **£3.14/mo per paying sub**

**Sensitivity:** if SBP lapses and Apple takes 30%, Pro mobile-annual net drops to £2.92/mo eff. and blended falls to ~£2.78/mo. **Confirm SBP enrolment before the next runway update.**

---

## Break-even (recomputed)

Target: cover burn at blended £3.14/sub.

| Mix | Net £/sub/mo | Paying subs needed |
|---|---|---|
| **Current (~£388/mo card, May 2026)** | **£3.14** | **~124** |
| **All-in (~£395/mo incl. Apple)** | **£3.14** | **~126** |
| Legacy (~£262/mo, Apr snapshot) | £3.14 | ~84 |
| Pro mobile-annual only (worst-case net) | £3.54 | ~110 at £388 burn |
| Pro web-monthly only (best-case net) | £6.23 | ~62 at £388 burn |
| Same blended, with 8%/mo churn buffer | £3.14 | ~135 net-active steady-state |

For comparison: previous Notion model said 55 subs at headline pricing; Apr snapshot was ~84 at £262 burn.

---

## Churn

Consumer fitness/nutrition apps see **7–10%/mo gross churn pre-PMF**. Using **8%/mo**:
- To hold 100 paying subs → must add 8/mo just to stand still.
- To grow by 10/mo net → must add 18/mo gross.
- Revise to 5%/mo once habit loop (Today + Plate loop daily + weekly recap) shows daily-active >40% retained at week 4.

---

## 12-month projection — three scenarios

All use blended net £3.14/sub/mo, churn 8%/mo, and **~£388/mo card burn**. Free signups cumulative. Gap column = Net MRR minus £388 burn.

### Slow case — 1.5% conversion, weak launch traction

| Month | Free cumulative | Gross paid adds | Active paid | Net MRR (£) | vs £388 burn |
|---|---|---|---|---|---|
| 1 | 100 | 2 | 2 | £6 | -£382 |
| 3 | 500 | 6 | 14 | £44 | -£344 |
| 6 | 1,500 | 15 | 45 | £141 | -£247 |
| 12 | 4,000 | 30 | 110 | £345 | **-£43** |

Break-even ~Month 13+ (110 subs × £3.14 = £345 MRR still below £388 burn).

### Base case — 3% conversion, moderate MFP-exodus tailwind

| Month | Free cumulative | Gross paid adds | Active paid | Net MRR (£) | vs £388 burn |
|---|---|---|---|---|---|
| 1 | 300 | 9 | 9 | £28 | -£360 |
| 3 | 1,200 | 27 | 62 | £195 | -£193 |
| 6 | 4,000 | 60 | 170 | £534 | **+£146** |
| 12 | 12,000 | 120 | 420 | £1,319 | **+£931** |

Break-even ~Month 6 (was ~Month 5 at Apr £262 burn).

### MFP-capture upside — 4% conversion, exodus 2026-05-03 captured aggressively

MFP mass-exodus on 2026-05-03 (per memory) is the launch tailwind. Refugees arrive habit-already-formed (calorie-tracking muscle memory). Channels: Reddit (r/loseit, r/MyFitnessPal), TikTok/Instagram "MFP refugee" content.

| Month | Free cumulative | Gross paid adds | Active paid | Net MRR (£) | vs £388 burn |
|---|---|---|---|---|---|
| 1 | 800 | 32 | 32 | £100 | -£288 |
| 3 | 3,500 | 108 | 205 | £644 | **+£256** |
| 6 | 10,000 | 180 | 560 | £1,758 | **+£1,370** |
| 12 | 30,000 | 240 | 1,300 | £4,082 | **+£3,694** |

Break-even ~Month 3 (was ~Month 2 at Apr £262 burn).

---

## Cash from annual prepay (separate from MRR)

MRR shows annual at effective-monthly. **Cash is real on day 1** for annual subs:

| SKU + platform | Cash on day 1 | MRR contribution |
|---|---|---|
| Pro annual (mobile, Apple SBP) | £42.49 | £3.54/mo |
| Pro annual (web, Stripe) | £48.05 | £4.00/mo |
| Base annual (mobile, Apple SBP) | £21.24 | £1.77/mo |
| Base annual (web, Stripe) | £23.92 | £1.99/mo |

Example: 10 mobile-annual Pro subs in one month = **£425 cash upfront** vs only £35/mo MRR contribution. Useful for runway, not P&L. **Track separately on Runway snapshot.**

---

## Sensitivity to Claude usage

Claude ≈53% and Cursor ≈31% of visible vendor spend (Jan–18 Jun 2026). Each **£50/mo** of extra AI spend ≈ **~16 extra blended subs** at break-even (£50 ÷ £3.14).

---

## Linear ops sync

Burn snapshot lives in Linear doc **Suppr Ops — vendors & runway**. Refresh when monthly burn changes materially (>10%). Vercel **$27 YTD** = two domain renewals (`suppr-club.com` Apr, `gosloe.com` 2 Jun). Apple **$99/yr** paid 13 Apr 2026 on a separate card — count in infra even when absent from card export.

---

## Where to track actuals

| Metric | Source | Cadence |
|---|---|---|
| Paying users | Stripe dashboard (web) + RevenueCat dashboard (mobile) | Monthly, 1st |
| Free signups | Supabase `auth.users` count or PostHog MAU (project 389168) | Monthly |
| Conversion % | Paid ÷ total active, by acquisition cohort | Monthly once >20 paid |
| Churn | Stripe + RC cancellations | Monthly once >20 paid |
| Apple SBP status | App Store Connect → Agreements, Tax, Banking | Annual + on any flag |
| VAT thresholds | UK £90k/yr; EU from €1 (non-est. supplier) | Per-region revenue tracker |

---

## Open assumptions to validate

1. **Platform mix (60/40 mobile/web)** — revisit after first 90 days. If web outperforms mobile, blended net rises (Stripe fees < Apple cut).
2. **Billing-period adherence** — web default monthly, mobile default annual. If real users override (e.g. mobile users pick monthly for low commitment), Pro mobile-monthly net rises to £5.66 from £3.54 effective.
3. **Apple SBP enrolment** — **OPEN — confirm in App Store Connect.** Drops mobile-annual net 14% if lapsed.
4. **Conversion benchmark (3% base)** — re-baseline at 30 paying users. Photo-log + voice-log moats may lift it; MFP-exodus tailwind should lift it.
5. **Churn 8%/mo pre-PMF** — first signal at week 4 of TestFlight cohort. Revise after first 30-day cohort retention measured.
