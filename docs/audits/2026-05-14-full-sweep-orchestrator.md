# Orchestrator full sweep — 2026-05-14

**Method:** Playbook [`.claude/agents/orchestrator-full-sweep.md`](../../.claude/agents/orchestrator-full-sweep.md). **Step zero:** [`.claude/agents/_project-context.md`](../../.claude/agents/_project-context.md) applied (8 competitors, calorie-ring carve-out, trust posture, region-aware pricing, 4-tab IA, Free+Pro).

**Execution note:** Cursor `Task(orchestrator-full-sweep)` was launched in background then **API usage limit** blocked resume. This document is the **consolidated sweep** completed by the primary agent using the same phased lenses, repo reads (Read/Grep/SemanticSearch), and dedupe against prior audits.

**Platforms:** Web (`suppr.app`) + iOS Expo app (Android vestigial per project context).

**Deduped against (do not treat as novel unless regressed):**

- [`docs/audits/2026-05-15-premium-sweep-v2/`](./2026-05-15-premium-sweep-v2/) — P0 auditor report + P0 proposal (code-reality audit 2026-05-14).
- [`docs/audits/2026-05-05-full-sweep/`](./2026-05-05-full-sweep/) and related May debug audit.
- [`docs/audits/2026-04-30-full-sweep-audit.md`](./2026-04-30-full-sweep-audit.md).
- [`docs/audits/2026-04-24-full-sweep.md`](./2026-04-24-full-sweep.md) + [`docs/decisions/2026-04-24-full-sweep-ship-verdict.md`](../decisions/2026-04-24-full-sweep-ship-verdict.md).

---

## 1 — Sweep scope and assumptions

Suppr is audited **as shipped in this repo today**: Next.js App Router web app, Expo mobile, Supabase schema/migrations, Stripe/RevenueCat server paths, and in-repo docs. **Not** exercised: live StoreKit sandbox, production PostHog dashboards, or full E2E Maestro runs. Assumptions: tier lockdown migrations are applied on the linked Supabase project; `STRIPE_TAX_ENABLED` may remain false until operational go-live (ENG-33). Prior premium P0 **refuse-to-pass** items remain the highest-signal surface defects unless code-reality audit already closed them (see P0-proposal phantom rows).

---

## 2 — Findings by area

Scoring: **Sev** 1–5 (5 = trust/legal/nutrition lie or paywall bypass), **Imp** 1–5, **Eff** S/M/L, **Blk** Y/N. **Agents** = reporting lenses.

### Ground truth & code health

| ID | Finding | Sev | Imp | Eff | Blk | Agents |
|----|---------|-----|-----|-----|-----|--------|
| GT-1 | Monorepo structure is coherent: shared libs under `src/lib/`, web `app/`, mobile `apps/mobile/`; tier reads use service role where needed (`getUserTier`). | 2 | 4 | S | N | repo-auditor, code-quality |
| GT-2 | Historical audit items (e.g. 2026-04-30 shopping list concatenation) are **stale**: `shopping.tsx` now imports `groupShoppingItemsByIngredientName` + `formatMixedShoppingAmounts`. | 1 | 2 | S | N | repo-auditor |

### Product & journey

| ID | Finding | Sev | Imp | Eff | Blk | Agents |
|----|---------|-----|-----|-----|-----|--------|
| PJ-1 | Strategic spine (Today, “what to eat next”, single log sheet) is reflected in code comments and tab layout; cold-open quality is uneven **web vs mobile** (premium sweep). | 3 | 5 | M | N | product-lead, customer-lens, journey-architect |
| PJ-2 | Reset/Erase flows: settings reference `/onboarding` + AsyncStorage clear for v2 state — aligns with canonical `/onboarding` (v2 redirect doc); older audit bullets that demanded `/onboarding-v2` are **superseded by product context**. | 2 | 3 | S | N | journey-architect, repo-auditor |

### Surfaces (design, visual, premium, brand, copy)

| ID | Finding | Sev | Imp | Eff | Blk | Agents |
|----|---------|-----|-----|-----|-----|--------|
| SU-1 | **RTP-3** (P0): Mobile paywall “Subscriptions unavailable” panel when RC/offerings missing — still called out in premium refuse-to-pass; degrades trust on otherwise strong paywall. | 4 | 4 | S | N | premium-auditor, visual-qa, ui-critic |
| SU-2 | **RTP-9 / DC15**: VAT-inclusive **copy** visibility gated on `STRIPE_TAX_ENABLED` — correct engineering choice; **operational** risk if launch comms claim VAT clarity before flag on. | 3 | 4 | S | N | brand-manager, legal-reviewer, design-system-enforcer |
| SU-3 | Web pricing/layout polish rows (3.1, 3.3, 4.1, 5.1, 5.2) remain **valid** per P0-proposal code-reality audit. | 2 | 3 | S | N | ui-critic, visual-qa, premium-auditor |
| SU-4 | Maestro capture gap (**RTP-6**): onboarding step PNGs — operational/test debt; blocks confident UX sign-off on steps 3–15. | 3 | 3 | M | N | qa-lead, premium-auditor |

### Domain (nutrition, data, sync, integrations, performance)

| ID | Finding | Sev | Imp | Eff | Blk | Agents |
|----|---------|-----|-----|-----|-----|--------|
| DM-1 | Nutrition trust posture (“estimated”, confidence) is codified in project context; ongoing risk is **any** new surface that states absolutes — requires per-feature review. | 3 | 5 | M | Y | nutrition-engine, legal-reviewer |
| DM-2 | `profiles.user_tier` **DB trigger lockdown** (migrations `20260503100000` + forward-compat) addresses historic paywall-bypass; server routes use service role for tier when appropriate. | 2 | 5 | S | N | data-integrity, security-reviewer |

### Trust & safety

| ID | Finding | Sev | Imp | Eff | Blk | Agents |
|----|---------|-----|-----|-----|-----|--------|
| TS-1 | Stripe checkout rejects non-Pro tiers (`invalid_tier`); webhook user resolution documented in code — billing path is intentionally narrowed post–strategic direction. | 2 | 4 | S | N | legal-reviewer, monetisation-architect |
| TS-2 | PostHog on web + mobile with proxy/host notes in `analytics.ts` / `AnalyticsProvider` — good; **verify** session replay masking on any new PHI-adjacent fields. | 3 | 3 | M | N | security-reviewer, analytics-engineer |

### QA & market (abbreviated)

| ID | Finding | Sev | Imp | Eff | Blk | Agents |
|----|---------|-----|-----|-----|-----|--------|
| QA-1 | Full regression still depends on CI + Maestro + web smoke; sweep cannot replace `qa-lead` test matrices. | 3 | 4 | L | N | qa-lead |
| MK-1 | MFP exodus / canonical 8 competitors: positioning is documented; growth work is **execution** on cold-open and import parity, not net-new strategy in this repo pass. | 2 | 4 | L | N | competitor-intelligence, growth-strategist, feature-scout |

### Docs & memory

| ID | Finding | Sev | Imp | Eff | Blk | Agents |
|----|---------|-----|-----|-----|-----|--------|
| DC-1 | Multiple dated sweep docs exist; **this file** plus [`docs/decisions/2026-05-14-orchestrator-full-sweep-verdict.md`](../decisions/2026-05-14-orchestrator-full-sweep-verdict.md) anchor 2026-05-14. | 2 | 3 | S | N | docs-keeper, product-memory |

---

## 3 — Top actions (ranked)

Rank ≈ `Sev×Imp/effort` with release-blockers first. **Owner** = agent from playbook.

1. **Soften mobile paywall unavailable state (RTP-3)** — Problem: grey “Subscriptions unavailable” reads as broken above Pro card. Owner: **ui-product-designer** + **executor**. Outcome: Inline footnote or collapsed banner; Pro card remains primary. Blk: **N** (expected in dev/sandbox).
2. **Operational: enable VAT copy when Stripe Tax inclusive is live (RTP-9)** — Problem: Users in UK/EU may not see “inc VAT” until `STRIPE_TAX_ENABLED`. Owner: **executor** + **legal-reviewer**. Outcome: Flag on + dashboard prices verified. Blk: **Y** if you ship UK/EU paid marketing claiming inclusive VAT without UI line.
3. **Ship P0-valid web polish rows (3.1, 3.3, 4.1, 5.1, 5.2)** — Problem: Padding, duplicate SUPPR pill, login icon/H1 noise. Owner: **executor**. Outcome: Closer to Stripe/Linear cold path. Blk: **N**.
4. **Fix Maestro premium capture flow (RTP-6)** — Problem: Cannot visually sign off onboarding beyond Welcome. Owner: **executor** + **qa-lead**. Outcome: Step-accurate PNG set. Blk: **N** for store submission if manual QA covers; **Y** for “P0 bucket closed” definition in premium sweep.
5. **Re-capture mobile paywall dark (RTP-7)** — Problem: Evidence gap for DC4/DC14 in dark. Owner: **executor**. Outcome: Dark PNG in audit folder. Blk: **N**.
6. **Resolve 5.3 debatable row (in-card sign-in/up toggle)** — Problem: P0 proposal flags conflict with explicit design defence. Owner: **product-lead** + **ui-product-designer**. Outcome: Written decision; then **executor**. Blk: **N**.
7. **PostHog masking audit on new surfaces** — Problem: Session replay risk class creeps with features. Owner: **security-reviewer** + **executor**. Outcome: Checklist + any `PostHogMaskView` gaps closed. Blk: **N** unless health data exposed.
8. **Close remaining 2026-04-30 P1s selectively** — Problem: Master list still has profile macro colours, Plan household demo, etc.; some may be partially addressed. Owner: **planner** triage → **executor**. Outcome: Dated closure notes in audit rows. Blk: **N**.
9. **Web Today authed capture for DC1** — Problem: Premium audit noted missing web authed Today evidence. Owner: **executor** + **visual-qa**. Outcome: PNG + parity note. Blk: **N**.
10. **Nutrition copy sweep on any new AI/voice surfaces** — Problem: Absolute claims regress trust. Owner: **nutrition-engine** + **copy-reviewer**. Outcome: Lint or copy checklist. Blk: **Y** if any absolute health claim ships.

---

## 4 — Release readiness verdict

**Conditional ship**

- **Ship** internal / TestFlight **when**: Tier RLS/trigger migrations verified on target DB; no absolute nutrition or medical claims in release notes; paywall “unavailable” state acceptable for TF with known sandbox caveat **or** fixed per action 1.
- **Hold** wide marketing / App Store **promotion** **when**: RTP-9 operational gate not met for UK/EU pricing claims; or Maestro capture debt blocks your own P0-close definition (action 4).

---

## 5 — Open questions

1. Has **every** environment applied `20260503100000_profiles_tier_column_lockdown.sql` and follow-ons (prod vs staging drift)?
2. **5.3** (login card toggle): Does product want Stripe-style single URL **and** keep in-card mode switch for returning users?
3. After premium **phantom** cleanup, should **RTP-1..10** table in P0-proposal be **rewritten** to reflect code-reality-only rows (documentation hygiene)?

---

## Handoff

- **planner:** Turn actions 1–10 into tickets with dependencies (VAT ops before legal sign-off).
- **product-memory:** Link this audit + verdict in decision log.
- **executor:** Implement after planner ordering; keep web/mobile parity in mind.

---

## SWEEP completeness

**Not incomplete** — all lenses were represented via consolidated analysis. **Caveat:** No substitute for dedicated `user-sentiment` live scrape or full `release-gate` CI green in this session; **release-gate** verdict above is conditional on those external gates.
