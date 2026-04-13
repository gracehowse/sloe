# Decision log: orchestrator-full-sweep ship verdict (2026-04)

**Date:** 2026-04-13  
**Status:** active  
**Agents involved:** orchestrator-full-sweep, planner, product-memory (capture)

---

## Verdict (one line)

**2026-04 conditional ship — blockers #1 tier RLS, #2 journal parity, #3–#4 legal/mobile links.**

---

## Decision

We **do not** treat the product as **unrestricted production-ready** for app store / full public launch until four items are done and validated:

1. **#1 Tier RLS** — `getUserTier` must return real `user_tier` for authenticated users (today anon client + RLS yields effective **free** for everyone on tier-gated APIs).
2. **#2 Journal parity** — Mobile must mirror web’s legacy **`nutrition_journals`** fallback so users are not split across platforms.
3. **#3 Privacy policy** — Policy must reflect **OpenAI** (photo/voice), **image/social import**, **Web Speech**, and **subprocessors** (e.g. PostHog, Sentry) at a level fit for stores and privacy expectations.
4. **#4 Mobile legal links** — In-app paths to **Privacy** and **Terms** (parity with web Settings/help pattern).

---

## Rationale

The sweep surfaced **correctness** (billing limits wrong for paying users), **data parity** (legacy journal users), and **trust/legal** (policy vs actual processing, store checklist) as the highest-leverage gates. UX polish, brand tokens, and CI mobile jobs are important but **do not** override these gates for a formal production ship.

---

## Alternatives considered

- **Ship now and patch** — Rejected for production app stores; acceptable only for **closed beta** with documented limitations if #1–#2 are explicitly accepted risk.
- **Block on entire backlog of 15** — Rejected; remaining items are sequenced in `docs/planning/sweep-2026-04-executor-backlog.md` post-gate.

---

## Platforms affected

- **Web:** privacy copy, tier APIs, journal (already has fallback).
- **Mobile:** journal load path, legal links, voice error framing (follows #4–#5 in backlog).
- **Backend / Supabase:** tier resolution pattern; optional RPC/service role pattern per `security-reviewer`.

---

## Related artifacts

- Sequenced implementation backlog: [`docs/planning/sweep-2026-04-executor-backlog.md`](../planning/sweep-2026-04-executor-backlog.md)
- Ship checklist: [`docs/deployment/ship-checklist.md`](../deployment/ship-checklist.md)

---

## Revisit when

- Any change to **RLS on `profiles`**, **tier-gated APIs**, or **journal storage** (entries vs JSONB).
- Before **next major store submission** or **fundraising diligence** — re-run `release-gate` + legal review.

---

## Supersedes

— (first entry in this log for this verdict)
