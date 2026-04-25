# Decision log: canonical domain + "Suppr Club" rename (2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved (recommendation accepted) — implementation pending
**Owner:** `brand-manager` (recommendation), Grace (registrar verification + accept), `executor` (sweep)

Closes T17 (canonical domain) and T18 ("Suppr Club" naming) from the [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md).

---

## 1. Canonical domain: `suppr-club.com` (hyphenated — confirmed 2026-04-25)

**Updated 2026-04-25 (Grace):** `supprclub.com` is **not available** at registrar. Only `suppr-club.com` was registrable. The hybrid recommendation in the original draft assumed the unhyphenated form was obtainable; it isn't.

**Decision: keep `suppr-club.com` as the canonical domain. No migration needed.**

This collapses the entire T17 workstream:

- The ~12 surfaces already cite `suppr-club.com` — they are correct, not legacy.
- No 301 forward is needed (we don't own the unhyphenated form to forward *from*).
- DMCA-agent registration stays as-is on the hyphenated form.
- Spoken parity is moot — there's no alternative to refer back to.

The TM-collision weight argument (`project_trademark_risk.md`) cuts the *opposite* direction now: with the unhyphenated domain unavailable, the "Suppr Club" rebrand below (§2) does **more** of the work to decouple the product name from the domain. The domain becomes a legal/operational alias, the wordmark is "Suppr".

~~Caveat — registrar ownership.~~ Resolved: Grace confirms `suppr-club.com` is registered to her.

---

## 2. "Suppr Club" naming: hybrid — keep "Suppr", drop "Club" framing

**Picked option (c) — hybrid.** Renaming away from "Suppr" entirely is a second rebrand inside six months and burns the `supprclub.com` decision above. Counsel-signed risk acceptance on "Suppr Club" is the wrong shape of risk: TM-1 hasn't cleared, "Supper Club!" is a live App Store competitor in the same category. That's not a memo-able risk; that's a "stop cementing it on the welcome screen" risk.

Hybrid keeps the wordmark Grace already invested in, removes the colliding two-word phrase from any surface a user, reviewer, or opposing counsel sees first, and leaves "Suppr Club" recoverable later as a community/membership tier name **if** TM-1 clears.

---

## 3. Replacement copy (web onboarding welcome)

| Surface | Old | New |
|---|---|---|
| Headline | `Join the Suppr Club.` | `Eat well, without overthinking it.` |
| Sub | `Eat well. Cook what you want. Know what's in it.` | `Plan, log, and learn what your body actually wants.` |
| Primary CTA | `Join the club — free` | `Get started — free` |
| Secondary CTA | `I'm already a member` | `I already have an account` |

**Landing page** (any "Suppr Club" hero/section refs): replace `Suppr Club` standalone references with `Suppr`. Replace `Join the club` with `Start free` or `Get Suppr free`. Membership/community phrasing → `Suppr members` is fine if needed downstream; avoid `the club` as a noun.

**Paywall footer:** `Suppr Club is operated by [entity]` → `Suppr is operated by [entity]`. Any `Suppr Club Premium` → `Suppr Premium`. Support contact strings follow the domain decision in §1.

**FloatingPreview chip** (`Matched against USDA`): keep — it's a credibility signal — but ensure surrounding copy doesn't reintroduce club framing.

---

## 4. Mobile / web divergence — converge

The 2026-04-21 [welcome copy divergence](./2026-04-21-onboarding-welcome-copy-platform-divergence.md) was a carve-out specifically because mobile already had the better, non-club copy. The rename brings web *to* mobile's line, not the other way around. The headline above is exactly mobile's `Eat well, without overthinking it.` — that's deliberate.

**Action:** retire the divergence carve-out in the same PR; sync-enforcer goes back to flagging this surface as a parity-required pair.

---

## 5. Sequencing — T17 closed, T18 ships solo

**Updated 2026-04-25:** With `supprclub.com` unavailable, T17 is **closed without a migration**. T18 (rename) ships solo as the only T17/T18 work.

The original argument for sequencing (rename first so the domain becomes "just an alias") still holds — it's just become moot in the same step. The rename is the *only* work that decouples product name from domain when the domain is forced to remain hyphenated.

**PR sequence:**

1. **T18 PR (only)** — web onboarding welcome + landing + paywall copy sweep, kill divergence carve-out, update sync-enforcer rules. No domain string changes.

---

## Pending Grace actions

1. ~~**Confirm registrar ownership of `supprclub.com`.**~~ Resolved 2026-04-25: only `suppr-club.com` was registrable; canonical stays hyphenated.
2. **Accept this recommendation in writing** (Slack / commit message / 👍 on this doc) so executor can ship T18 PR.
3. ~~**Re-register DMCA agent** at the new email after T17 PR ships~~ Not needed — domain unchanged.

---

## Related

- [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md) §B4, §B5
- [2026-04-21 onboarding welcome copy divergence](./2026-04-21-onboarding-welcome-copy-platform-divergence.md) — retired by this decision
- Project memory: `project_trademark_risk.md`, `project_rebrand_checklist.md`
- Notion mirror pending: Decisions log row + Roadmap T17/T18 → In progress
