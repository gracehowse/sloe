# Decision log: canonical domain + "Suppr Club" rename (2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved (recommendation accepted) — implementation pending
**Owner:** `brand-manager` (recommendation), Grace (registrar verification + accept), `executor` (sweep)

Closes T17 (canonical domain) and T18 ("Suppr Club" naming) from the [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md).

---

## 1. Canonical domain: `supprclub.com` (no hyphen)

**Picked the unhyphenated form.** Three reasons in priority order:

1. **Legibility + premium feel.** Hyphens read as SEO-bait or as the fallback when the clean string wasn't available. A premium brand owns the clean string.
2. **Verbal parity.** Nobody says "suppr dash club dot com." Spoken and written should match.
3. **Cost of migration is bounded.** ~12 surfaces cite the hyphenated form (DMCA agent, privacy controller, refund support, VAPID subject, Stripe support, App Store support URL, paywall footer, mobile `app.json`, etc.). One-afternoon sweep with a 301 forward from the hyphenated domain held defensively.

The TM-collision weight argument (project memory `project_trademark_risk.md`) cuts the same direction: if "Suppr Club" naming gets pulled (see §2), the *-club.com domain question is mostly moot for marketing surfaces — both forms become operational/legal aliases. Pick the legible one.

**Caveat — registrar ownership.** Verify `supprclub.com` is actually under Suppr's control before any migration. Audit-flag implies it might not be. **If it isn't, that's the blocker — resolve registrar ownership first, then migrate.**

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

## 5. Sequencing — T18 first, then T17, same week

**Ship T18 (rename) first, then T17 (domain) — separate PRs, same week.**

- The rename changes the *shape* of the domain decision. Once "Suppr Club" is off first-impression surfaces, `supprclub.com` is just an operational/legal alias — lower stakes, cleaner migration.
- Reverse order entrenches the colliding mark for another sprint while domain work happens.
- Same-week because the App Store DMCA-agent bounce risk is real and Grace is solo-tester right now — the cohort blast radius for the domain migration is N=1, which is the cheapest it will ever be.

**PR sequence:**

1. **T18 PR** — web onboarding welcome + landing + paywall copy sweep, kill divergence carve-out, update sync-enforcer rules.
2. **T17 PR** — registrar ownership confirmed → migrate all ~12 surfaces to `supprclub.com`, hold `suppr-club.com` as defensive forward, update DMCA-agent registration last (it's the safe-harbour-critical one).

---

## Pending Grace actions

1. **Confirm registrar ownership of `supprclub.com`.** This gates T17 PR.
2. **Accept this recommendation in writing** (Slack / commit message / 👍 on this doc) so executor can ship T18 PR.
3. **Re-register DMCA agent** at the new email after T17 PR ships (only Grace can do this; agent registration is a manual federal-DMCA-database flow).

---

## Related

- [2026-04-24 full-sweep ship verdict](./2026-04-24-full-sweep-ship-verdict.md) §B4, §B5
- [2026-04-21 onboarding welcome copy divergence](./2026-04-21-onboarding-welcome-copy-platform-divergence.md) — retired by this decision
- Project memory: `project_trademark_risk.md`, `project_rebrand_checklist.md`
- Notion mirror pending: Decisions log row + Roadmap T17/T18 → In progress
