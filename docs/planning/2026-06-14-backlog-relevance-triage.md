# Backlog relevance triage — 2026-06-14

Grace: "backlog is still massive (250 items), check they are all relevant." Ran an 8-lane parallel triage (one per project cluster) over every open issue, each agent cross-referencing the repo + decision docs.

## Headline

**280 open issues triaged. ~86% (241) are genuinely active — the backlog is large but mostly real, not junk.** The cull executed: **23 closed** (evidence-backed, reversible) + **2 reopened** (verification caught agent over-claims — see below) + **14 flagged for Grace** (judgment calls). No whole project is cleanly archivable (the Premium P0–P5 shells already hold 0 open issues; the "Premium experience" initiative was archived 2026-06-11).

Counts (final, post-verification): keep 241 · close-done 10 · close-obsolete 6 · close-superseded 5 · close-duplicate 2 · reopened 2 · revisit-stale 14.

**Verification reopens (don't trust agent text — checked each "done" claim against the repo):**
- **ENG-805** (weekly check-in → in-feed card) — REOPENED to Todo. Mobile shipped, but web `NutritionTracker.tsx:3011` still renders `WeeklyCheckinDialog` — the web demote is outstanding, so the cross-platform parity isn't done.
- **ENG-915** (redesign close-out / web "Continue with email" progressive disclosure) — REOPENED to Todo. Mobile `login.tsx` done, but the web "Continue with email" affordance was not found — web side incomplete.
- ENG-985 / ENG-833 / ENG-839 / ENG-843 verified genuinely done and left Done.
Lane open-counts: premium-legacy 0 · redesign 17 · figma 32 · category-leading 56 · audit-sweep 32 · launch 45 · surfaces 41 · platform 57.

## Closed (23) + reopened (2)

**Shipped — already on main, stuck In-Review/Backlog → Done (10, after 2 verification reopens):**
- ENG-811 (hex-lint guard, eslint.config.mjs), ENG-826 + ENG-833 (web ring gradient + win-pulse, = ENG-1086/1093), ENG-839 (web sheet morph, log-sheet.tsx), ENG-767 (auth email progressive disclosure), ENG-843 (ci type-scale gate, package.json — also dup of ENG-1074 Done), ENG-985 (Progress 492:2 mobile parity).
- Title says "not built" but it is: ENG-934 (SlotMacroChips per-meal macros), ENG-950 (weightView defaults to trend hero), ENG-967 (PaywallComparison Free-vs-Pro matrix).
- ~~ENG-805, ENG-915~~ — agent claimed Done; repo check found web side incomplete → **reopened to Todo** (see Headline).

**Superseded → Canceled (5):**
- ENG-532/533/538/539 — premium-sweep-v2 capture/evidence debt; the "Premium experience — launch bar" program was archived 2026-06-11, re-skin work moved into Redesign P1/P2/P4.
- ENG-148 — Suppr-Club→Suppr rename overtaken by the Sloe rebrand (1 literal left; Sloe ships widely).

**Obsolete → Canceled (6):**
- ENG-830 — finish flag-gating elevation surfaces; void after the 2026-06-12 flat-card decision retired soft-lift + deleted the `design_system_elevation` flag.
- ENG-909 — build single-day Plan frame; killed by ENG-919 "keep multi-day grid" (its own "likely superseded" clause).
- ENG-914 — Google Sign-In frame; blocked on ENG-924, resolved "Apple + email only".
- ENG-189 — April-2026 legal-register sweep (2+ months stale; needs a current-month instance).
- GROW-12 — D-1 soft-launch checklist tied to a passed 2026-05-23 date, overtaken by the 2026-07-01 launch.
- ENG-844 — landing app-showcase stale tab IA; the targeted PhoneTabBar/code mockups were deleted (now device-frame PNGs).

**Duplicate → Duplicate (2):**
- ENG-486 → ENG-198 (code half shipped via ENG-588/528; remaining "RC offerings dashboard provisioning" IS ENG-198).
- ENG-1088 → ENG-853 (same docs-only-PR-blocked-by-required-visual-checks problem; ENG-853 is the fuller canonical).

## Flagged for Grace (14 — judgment calls, NOT closed)

- **Figma re-scope under APP-FIRST pivot:** ENG-903, 889, 897, 907, 908 — partials counts stale; resurrect / re-scope / shelve each.
- **Rebrand + handle sweep (real work, dead-name framing):** ENG-172 (branding sweep), ENG-183 ("Atlas" TM direction), GROW-15 (@suppr handle list) — re-scope as Sloe or confirm getsloe/@getsloe covers it.
- **Unadjudicated auth/UX product calls:** ENG-525 (/login sign-up toggle keep/remove), ENG-65 (hero-ring gesture web/mobile asymmetry — likely a defended divergence; also miscategorised under Landing), ENG-848 (wire-or-delete web MacroDetailPanel).
- **Maestro flow possibly obsoleted:** ENG-531 (00c_onboarding_v2 yaml fix — Maestro WDA broken on iOS 26.5; capture moved to simctl/idb).
- **Stale finance one-off:** ENG-190 (April runway snapshot — close or replace with current month).
- **Deferred-by-decision net-new builds — still wanted?:** ENG-913 (Ask-coach screen), ENG-71 (re-export landing bundle), ENG-121 (north-star scorer characterisation).

## Keep — the 241 active themes
Category-leading growth backlog (ENG-928→983), MFP-refugee capture loop, Figma conformance (surviving the pivot), AI image-gen + creator plane, monetisation/billing + legal/incorporation launch-blockers, Phase-0 viral metric gates, design-system token enforcement, architecture enablers/tech-debt, Plan Import (flag-gated off by design), shame-free gamification, health-sync, Today/Plan/Progress polish, schema follow-ups.

## Structural note
"Premium P5 — Architecture enablers" project label is dead but its issues (ENG-573/619/620/622/856/665/661) are live + carried under Platform foundations — re-home the issues + retire the legacy project shell (a Linear-UI move for Grace).

Full per-issue verdicts: workflow run `wf_35b1feb6-c02`.
