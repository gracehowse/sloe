# Fable day, part two — first session, motion, failure moments, copy, direction (2026-07-06)

**Companion to:** [2026-07-05 UI critique — Mobbin-benchmarked](./2026-07-05-ui-critique-mobbin-benchmark.md) (the static-screen pass). This document covers what static screens cannot: sequence, motion, emotional response under failure, the words, and the ratification status of the load-bearing design decisions.

**Author:** Claude (Fable judgment; Sonnet 5 capture/extraction). **Ask (Grace):** dedicate Fable to the judgment work only it can do — the first-session arc, the failure moments, the full copy read, and the direction pressure-test.

## Evidence base

- **Web first sessions:** two complete throwaway-account runs (signup → 17-step onboarding → first Today → first banana log) at 1440px and 390px — 83 verified PNGs, `screenshots/web-drive/fable-day-20260705/`.
- **iOS first session:** fresh-install onboarding on a second simulator (dev email auth), steps 8–17 + first log — 21 files, `apps/mobile/screenshots/agent/fable-day-20260705/{onboarding,firstlog}/` (steps 1–7 not captured; flow resumed mid-run).
- **Motion:** six screen-recorded transitions on the signed-in sim (tabs, log sheet, recipe push, day switch, paywall, full log-commit arc) with frame extraction at 8fps — `.../transitions/`.
- **Failure moments:** scripted over-budget progression (59% → 119% → 178%) on iOS + web, and a **seeded broken-streak fixture** (6 of 7 days logged via guarded INSERT-only writes on the throwaway account) — `.../failure/` with exact copy strings in a11y dumps alongside.
- **Copy:** full extraction — ~735 distinct user-facing strings from ~2,320 raw sites, organised by surface with file:line (session-scratchpad `copy-deck.md`, regenerable; 19 centralised SSOT modules catalogued, deck pointer on ENG-1378).
- Test accounts: five `…@example.com` throwaways on prod (cleanup list on ENG-1446); the data-rich account and Sloe-Verify sim untouched bar one sanctioned banana log.

---

## 1. The first hour — verdict

**The first hour is a V-shape: it starts at the product's absolute peak and collapses precisely at the handoff.**

The onboarding is the best-designed thing Sloe has — better than anything inside the app. The welcome screen (dark plum full-bleed, serif wordmark, one white CTA, "Private by default · About a minute") is the most confident screen in ~150 captures. The sequencing is best-practice executed with taste: came-from-app → why-now → live-feedback pace picker → the reveal → **auth after value** → data bridges → guided first win → **paywall after value**. The onboarding paywall dialog is the best conversion module in the product — concrete limits ("Up to 100 logs per day", "Free tier caps at 10"), trust strip, full price disclosure, £59.99 on the CTA itself — which makes the price-less iOS in-app paywall (ENG-1381) indefensible: the craft exists; iOS doesn't ship it.

Then the product takes over and burns the trust the funnel earned:

1. **The reveal ends broken on all three surfaces** — the PROJECTED TREND card is clipped by the fixed Continue on a page that cannot scroll (web fullPage == viewport; iOS swipe verified no-op). The single most motivating number in onboarding renders as a fragment with a lone floating dot. Desktop says "Your plan is ready." twice and introduces a fourth calorie-ring treatment. (ENG-1451)
2. **Fresh web accounts arrive with fabricated history** — EATEN 929, persona fixture meals, a "Day 1 — nice start" streak card, and coach advice ("Aim for about 429 kcal at dinner") computed from meals the user never ate, while Getting Started says 0/3. iOS accounts are clean (EATEN 0) — the bug is web-provisioning-specific. (ENG-1446)
3. **The first log can fail invisibly four ways** — the unreachable commit CTA on mobile-web (ENG-1445), the iOS relaunch silently reverting a committed log (ENG-1447), the staged basket silently discarding on close with its commit bar invisible from search results (ENG-1449), and the guided first-log "Search food" chip that no-ops and skips the log on Continue (ENG-1450). None requires an error to fire; all are structural. **These four outrank every aesthetic finding in part one.**

Ranked first-hour fixes beyond the P0s: un-clip the reveal (ENG-1451); collapse the trial page + dialog double-ask (ENG-1459); unify the ring treatment; fill the empty desktop narrative panel on steps 16–17; demote the repeat-log confirmation to a toast and keep the full ceremony for the first-ever log.

## 2. Motion — verdict

**Competent-native, zero signature; the failures are loading choreography, not animation.** Transitions (sheet slide-up, tab switches, day changes) are clean iOS-standard with no jank. But nothing arrives with its content: the log sheet lands before its thumbnails (white squares, then a pop of four identical — and wrong — berry-smoothie images, ENG-1448); Progress greets a tab switch with a skeleton. The app is static-calm where the direction calls for alive-calm. There is exactly one earned motion moment — the ring taking its first green segments after a log — and it is nearly there. The Lifesum/Oura feel requires that moment amplified (deliberate fill animation, coach line settling in after) and content arriving *with* its surface: image slots reserved, never popping.

**The money moment, judged:** "Logged to Snacks" — serif headline, Undo, then "Plan your day — about 1,795 kcal left. No rush." — is the right emotional register. Three faults: it's a full-sheet ceremony for a two-second repeat action (toast-with-Undo is the right weight after the first-ever log); "Est. 105 kcal" hedges on a structured USDA banana; and the ceremony asserts a success the persistence layer hasn't earned (ENG-1447). The confirmation writes cheques the sync can't cash.

## 3. Failure moments — the coaching-voice verdict

**The voice survives contact with failure exactly once, and it is the most important sentence in the product:**

> "This doesn't fit what's left today — but it's your call."

The pre-commit over-budget warning is permission-not-restriction made real — the entire brand thesis in eleven words, at the exact moment MyFitnessPal would shame the user. Protect it like the wordmark.

Everything after the commit breaks character:

- **Over-budget coaching is state-blind.** At 119% and at 178% over, the identical line: "You've hit your calories for today — eat freely, or save for tomorrow." At +1,450 kcal "eat freely" reads as parody, and directly beneath it the net-energy card states "You've eaten 2,204 more than you've burned today" — warm words, cold arithmetic, same screen. The ring is identically amber at both magnitudes (correct — no escalating visual shame); the *copy* must carry the difference. (ENG-1454)
- **The broken-streak recap states the law instead of offering grace.** A user who logged 6 of 7 days sees "2-day streak" beside "DAYS LOGGED 6 of 7" and a definition: "Counts every day with at least one meal logged." Streak freezes exist in the product and are absent at the exact moment of the break — the most monetisable retention moment in habit apps, currently a shrug. "PROTEIN … Hit your 130g goal on 0 of 7 days" ships with no next step even though the digest cascade already owns the right line ("A high-protein breakfast is the easiest fix"). Severe under-eating (563 vs 1,856) is presented with less care than over-eating — the safety-floor concern deserves a designed state. (ENG-1454)
- **The retired red survives** in the over-budget *label* on iOS and mobile-web (amber pill on desktop) — ENG-1296 shipped to the ring, not the pill. (ENG-1453)
- One good surprise: offline handling has designed copy — "Saved on this device — we'll sync this log when you're back online." The durability machinery exists; ENG-1447 is some path around it failing silently.

## 4. Copy — the editorial verdict

**Sloe already has an excellent editor; it's only allowed to work in three files.** `weeklyRecapPushBody.ts`, `weeklyDigestSuggestion.ts` and `importErrorCopy.ts` carry hard rules — no exclamation marks, no praise adjectives, no vendor names, no HTTP codes — **enforced by tests**. That's the house voice: calm, deadpan, precise. The other ~700 strings never met those rules. This is an extension-of-jurisdiction job, not a rewrite.

**The register, defined by its own best lines (the keep-list — this is the spec):** "Skipped — that's fine." · "No rush." · "Slower is easier to sustain; faster asks more of you." · "We'll store this privately. You can log it whenever — no daily prompts." · "Optional — it helps us keep your plan encouraging. Skip if you'd rather."

**The four drifts:** (1) *SaaS-chirp* — "Marked as made!", "Logged {meal} to your tracker!", "You're all set!" — the only exclamation marks in the product, all where the calm voice would land better; the ring moving is the celebration. (2) *Plumbing* — raw TDEE/BMR across Progress/pricing/check-in with three different labels for one concept, while a built jargon-gloss system sits default-OFF and onboarding-only (ENG-1461); plus genuine leaks: `EXPO_PUBLIC_API_URL` and "Supabase is not configured" in user-reachable alerts (ENG-1456). (3) *Defence* — the allergen string reads as a liability shield; same facts, addressed to a person, survives legal review. (4) *Entropy* — Title Case (mobile) vs sentence case (web) across whole component pairs; "Terms of use" vs "Terms of Service"; "…" vs "..."; five hand-rolled "Sign in to X" variants; `SUPPR_PRO` vs `SLOE_PRO` promo placeholders; **`SupprBot` in the live Terms** (ENG-1457).

**The voice contract (five rules):** no exclamation marks; no praise data doesn't earn (≥3 points before superlatives); no pipeline vocabulary (acronyms glossed or cut; vendor/env names never render); one name per concept, sentence case, one ellipsis character; reassurance lives where it converts — never as a nag inside a tool.

**The mechanism:** a `check:copy-voice` ratchet in the existing only-shrink family (greps UI strings for `!`, vendor/env names, bare TDEE/BMR outside the gloss system), plus finishing the SSOT migration for the ~15 documented per-platform copy forks. Mechanical once ratified; spec'd off the deck on ENG-1378.

## 5. Direction pressure-test — keep / sharpen / kill

Re-judging the load-bearing decisions against two days of evidence, per the "decided ≠ immune" rule:

**KEEP with confidence**
- **Warm-editorial serif-plum** *(resolves the standing open question)* — keep. Evidence: the onboarding welcome, the paywall headline, the pre-commit line. Nothing in the category matches it, and the Cal AI-style punchy alternative serves an audience Sloe explicitly didn't choose. Caveat: the shell only works fed — with food imagery (ENG-1374) and genuinely warm cream (ENG-1377); unfed it photographs as a beautifully typeset wireframe.
- **Today as centre** — reaffirmed; the ring-fill and day-planning coach lines are the product's best moments.
- **Amber-for-over, no escalating visual shame** — right call; identical ring at 119%/178% is correct. Finish shipping it (ENG-1453) and let copy carry magnitude (ENG-1454).
- **Muted-grey hierarchy; 4 tabs + FAB** — sound; enforce the existing 5:1 floor (dark-mode and web-header violations found).

**SHARPEN**
- **Streak mechanics** — right mechanic, unfinished break moment (ENG-1454); highest-leverage retention *and* monetisation surface.
- **Guided first log** — right idea, wrong affordance (ENG-1450).
- **One number pipeline** — the trust spine under every other decision; non-optional before launch (ENG-1373).

**KILL (recommended, Grace to ratify — ENG-1462)**
- **The log-sheet staging basket.** Two commit models on one sheet; the basket's commit bar is invisible from results and it silently discards (ENG-1449), while the product already owns the better model (add-with-undo + the "Logged to…" ceremony). Multi-item batching belongs in "Save a usual meal".

## Ledger

Part-two Linear output: ENG-1445–1454, ENG-1456–1462 (filed 2026-07-05/06), plus comments on ENG-1378 (copy deck, iOS copy nits), ENG-1379 (paywall repro of the `<Text>` error) and ENG-1446 (iOS-clean scoping + prod cleanup list). Combined with part one (ENG-1372–1386), the two-day engagement produced 32 tracked items. The launch-critical cluster: **the four ways a first log never reaches the ledger** (ENG-1445, 1447, 1449, 1450) **and the number pipeline** (ENG-1373).
