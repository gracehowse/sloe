# Persona session — cold-start-newcomer — 2026-06-14

- **Surface(s):** web (mobile-web, 390×844) — the genuine first-impression surface for this persona
- **Account:** `gracehowse+coldstart0614@outlook.com` — a **freshly-created** account (true cold start), created this session through the real `/onboarding` signup
- **Seeded:** no — created via the live onboarding flow, never logged anything (the authentic never-seen-anything path the persona doc calls for)
- **Auth path:** Path C variant — the documented persona account `gracehowse+coldstart@outlook.com / TestPass123!` is **not provisioned** (login returns "bad credentials / unconfirmed email"), so I signed up a fresh allowlisted account through the UI instead. Driven with a small Playwright harness (login + step walk) because the shared `tests/e2e/.auth/user.json` was being raced by concurrent nightly persona sessions.

## Goals attempted

1. **"Figure out what this app even is"** — ✅ **completed.** Landing + onboarding intro communicate it clearly in plain English ("Save any recipe from Instagram, TikTok or the web… works out the nutrition… no foods off-limits"). The TikTok framing matches exactly why this persona arrived. Good first impression.
2. **"Get set up without it taking forever or asking things I don't know"** — 🟡 **partial.** The 13-step onboarding *works* and has genuinely good helpers ("Which one should I choose?", "How does age affect my target?", "Prefer not to enter" weight escape, live rate→calorie feedback, a 1,200 kcal floor safety warning). But it is **13 steps** ("STEP 02 OF 13" shown up front — a length-anxiety trigger), asks for **account creation at step 2 before any value**, and uses jargon (below).
3. **"Log my first meal and have it feel easy and satisfying"** — 🟡 **partial.** The entry point is excellent — a central, obvious **"Log a meal"** FAB opening a clean sheet (meal selector, search, free barcode, voice, photo). But the sheet's "Recent" list and the Today screen are **pre-populated with meals the newcomer never logged**, so the *first*-log moment can't land (see Finding 01).
4. **"Understand my calorie target in plain words"** — 🟡 **partial.** The number is plain (1,338 kcal/day) and honestly flagged as an estimate, with a "Show the maths" affordance. But the supporting labels are **TDEE / BMR / Mifflin-St Jeor** with no gloss (Finding 02).
5. **"Look around the empty app, decide if there's a reason to come back"** — ✅ **completed.** Progress empty state teaches well ("New week, fresh story · Log 3 days to unlock · 0/3 logged"); Recipes/Discover gives a real return reason (prominent TikTok/Instagram import + browseable cards). Undercut by Today showing fake data (Finding 01).
6. **"Decide in 5 minutes: keep or delete"** — ⚖️ **lean keep, with a caveat.** The concept lands and the surfaces are well-built, but the phantom Today data (929 kcal "eaten" the user never logged, contradicting Progress's "0 logged") is the kind of thing that makes a skeptical newcomer distrust the numbers. Fix Finding 01 and this is a confident keep.

**Task success rate:** 2 / 6 fully completed, 3 / 6 partial, 0 abandoned.

## Findings

### Finding 01 — Fresh account's Today shows phantom logged meals + consumed calories
- **Journey:** Goals 3, 5, 6
- **Screen:** Today (ring + Today's Meals); Log-a-meal sheet (Recent tab)
- **What I expected:** A never-logged account shows an empty Today — full target remaining, no meals.
- **What happened:** Today shows ring **"409 LEFT · Under budget"** (1,338 − 929), **Breakfast 387 kcal** + **Lunch 542 kcal** as real rows, macro tiles partly filled (P 80/115, C 100/136, F 20/37), and the Log-sheet "Recent" pre-filled with "High-Protein Chicken & Rice Bowl" / "Overnight Protein Oats". **Progress correctly shows "0/3 days logged"** — the two surfaces contradict.
- **Severity guess:** P1 (→ P0 if root cause is cross-account data bleed)
- **Screenshot:** `apps/mobile/screenshots/personas/cold-start-newcomer/2026-06-14/50-today-empty.png`, `/51-today-full.png`, `/52-meals.png`, `/56-log-sheet.png`, `/54-progress.png`
- **Trust-impact:** yes — confident calories for food never eaten; the persona's defining trust break.

### Finding 02 — Onboarding leans on unexplained TDEE / BMR / Mifflin-St Jeor jargon
- **Journey:** Goals 1, 2, 4
- **Screen:** Onboarding intro · Step 09 (rate) · Step 12 (target reveal)
- **What I expected:** The number and where it came from in plain words.
- **What happened:** First intro bullet **"Adaptive TDEE that learns from you"**; rate screen **"VS. YOUR TDEE −440 kcal/day"**; reveal **"BMR 1,482", "EST. TDEE 1,778", "Mifflin-St Jeor equation"** — all unglossed. Mitigated by a plain headline number, honest "estimate" framing, and a "Show the maths" affordance.
- **Severity guess:** P2 (trust-impact yes — mild)
- **Screenshot:** `.../2026-06-14/02-onboarding-start.png`, `/17-ob-17.png`, `/20-ob-20.png`
- **Trust-impact:** yes

### Finding 03 — Onboarding is 13 steps; account creation is step 2 (before any value) — *report-only / deduped*
- **Screen:** Onboarding (all steps); "STEP 02 OF 13 — Create your account"
- **What happened:** "STEP 0X OF 13" shown throughout (length-anxiety for the MFP-refugee newcomer); signup demanded before any personalised number is shown.
- **Severity guess:** P2 — but already tracked: signup-before-value = **ENG-962** (commented). Length itself is borderline (13 quick taps with good helpers ≠ MFP's 17 dense screens) — noted here, not separately ticketed.
- **Screenshot:** `/03-onboarding-step1.png`
- **Trust-impact:** no (length), partial (signup-before-value)

### Finding 04 — Cookie-consent bar overlaps onboarding Back/avatar nav — *deduped*
- **Screen:** Onboarding (every step, 390px)
- **What happened:** The persistent consent bar overlaps the bottom-left "Back" button + avatar on each step. Same root cause as **ENG-802** (commented).
- **Severity guess:** P3 · **Trust-impact:** no
- **Screenshot:** `/17-ob-17.png`, `/21-ob-21.png`

### Finding 05 — "Getting Started" card floats over content on every tab — *deduped*
- **Screen:** Today / Progress / Recipes
- **What happened:** The "Getting Started · 0 of 3 complete" card overlays below-fold content on all tabs (covers meal rows on Today, weight card on Progress, recipe feed on Recipes). Extends **ENG-1183** (commented).
- **Severity guess:** P3 · **Trust-impact:** no
- **Screenshot:** `/52-meals.png`, `/54-progress.png`, `/55-recipes.png`

### What worked (kept honest — positives)
- Landing + onboarding intro: plain-English, on-message for the TikTok newcomer.
- Onboarding helpers: contextual "which should I choose?" links, sex midpoint explanation, "Prefer not to enter" weight escape, live rate→calorie feedback, and a responsible **1,200 kcal floor warning** ("consult your doctor") — trust-positive.
- Target reveal: honest "estimate / will re-calibrate" framing + "Show the maths" progressive disclosure.
- Log-a-meal sheet: obvious central FAB, clean, "Barcode scan is free — always."
- Progress empty state teaches the next action; Recipes/Discover surfaces the TikTok/Instagram import hook prominently.

## Linear

- **Filed new:**
  - [ENG-1186](https://linear.app/suppr/issue/ENG-1186) — Fresh account's Today shows phantom logged meals + consumed calories (P1, persona-feedback + Bug)
  - [ENG-1187](https://linear.app/suppr/issue/ENG-1187) — Onboarding target reveal + rate screens use unexplained TDEE/BMR/Mifflin-St Jeor jargon (P2, persona-feedback + Bug)
- **Commented on (deduped):**
  - ENG-962 — signup-at-step-2-before-value (corroborated)
  - ENG-802 — cookie-consent overlap (now also confirmed on pre-auth onboarding nav)
  - ENG-1183 — Getting Started card overlay (broader than Today — every tab)
  - ENG-1181 — related inverse of the Today-meals data-source bug (cross-referenced ENG-1186)

## Honest gaps

- **Documented persona account unprovisioned:** `gracehowse+coldstart@outlook.com / TestPass123!` failed login ("bad credentials / unconfirmed email"). Worked around by signing up a fresh account (`+coldstart0614`) through the real flow — arguably *more* authentic for this persona, but it means the canonical account still needs provisioning for repeatable runs. (Same class of gap as ENG-1185.)
- **Apple Sign-In journey not testable on web** — the intro's "I already have an account" / Apple path is out of scope here (Apple sheet).
- **Root cause of Finding 01 not resolved** — could not determine from a persona session whether the phantom Today data is intentional sample injection, stale cache, or cross-account bleed. Flagged in ENG-1186 for engineering; the cross-account possibility (which would be P0) needs a code-level check.
- **First-log not completed** — I exercised the Log sheet entry but did not commit a log (to keep the account's state clean and because the phantom Recents already demonstrated the Goal-3 friction).
- **Shared `tests/e2e/.auth/user.json` race** — concurrent nightly persona sessions repeatedly cleared the shared auth-state file; I drove via a per-run Playwright login instead. Worth giving each persona run an isolated auth-state path (relates to ENG-1185).

## Single worst friction

**A brand-new, never-logged account's Today screen confidently reports 929 kcal of food the user never ate ("409 LEFT · Under budget", Breakfast + Lunch rows, partial macros, pre-filled Recents) while Progress correctly says "0/3 days logged."** For the cold-start newcomer this is the exact trust break the whole persona guards against, and it makes the first-log activation moment impossible to feel. (ENG-1186.)
