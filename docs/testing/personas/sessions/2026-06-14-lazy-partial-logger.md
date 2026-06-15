# Persona session — lazy-partial-logger — 2026-06-14

- **Surface(s):** web (Path C)
- **Account:** gracehowse+lazylogger@outlook.com
- **Seeded:** yes (`node --import tsx scripts/seed-persona.mts --persona lazy-partial-logger --email gracehowse+lazylogger@outlook.com --reset`)
- **Auth path:** C (web with email auth via Playwright state)

## Goals attempted

1. **Quickly log the one thing I actually ate so far today** — PARTIAL
   - FAB (+ button) is prominently visible and obvious
   - Unable to fully test due to consent overlay blocking interaction
   - UX promise is clear, but execution blocked by overlays

2. **Glance at whether I'm under or over for the day — without doing setup** — COMPLETED ✓
   - "1,231 LEFT" is the first thing visible on Today
   - Goal / Eaten / Bonus breakdown is scannable in 2 seconds
   - No friction; matches persona's speed expectations

3. **Check what the app thinks my maintenance calories are, and whether it looks right** (LOAD-BEARING) — BLOCKED
   - This information is not visible on the Today screen viewport
   - Likely below the "Getting Started" onboarding card
   - Unable to scroll past overlays to access it
   - This is a critical gap for the persona's trust assessment

4. **See if the app nags me about the days I didn't log — and whether that feels supportive or shaming** — BLOCKED
   - Unable to scroll below the onboarding card to see daily view/messaging
   - Week strip shows logged days (dots), but no visible feedback on partial/empty days
   - Couldn't access the content to judge tone (supportive vs. shaming)

5. **Understand, in one screen, why my target is what it is** — BLOCKED
   - No explanation visible on Today screen
   - Likely requires scroll or navigation below the card stack
   - The "Fresh start" badge is vague — doesn't explain methodology

6. **Decide whether I trust this app's numbers enough to keep using it casually** — PARTIAL
   - Positive signal: "1,231 LEFT" is clear and scannable ✓
   - Negative signal: Can't see maintenance estimate or "why this number" explanation ✗
   - Persona conclusion after this session: "The app shows me what I need to know *right now*, but I can't verify if it knows *my* numbers. I'd keep using it casually, but wouldn't rely on it yet." — TRUST IS CONDITIONAL ON UNSEEN INFO

## Findings

### Finding 1 — Consent popup blocks logging flow and abandons low-friction user

- **Journey:** Goal 1 (quick log)
- **Screen:** Today / header area
- **What I expected:** Click the FAB, get to log food instantly. Taps: 1-2 max.
- **What happened:** Consent popup ("Essential cookies on...") locks interaction; cannot proceed past "Accept all" button. Web-drive interactions timeout; persona would abandon after ~8 seconds of non-responsive UI.
- **Severity guess:** P0 blocker
- **Screenshot:** `apps/mobile/screenshots/personas/lazy-partial-logger/2026-06-14/01-today-landing.png`
- **Trust-impact:** yes — persona interprets frozen UI as "the app isn't responsive"

### Finding 2 — "Getting Started" card hides critical information below the fold, blocking trust assessment

- **Journey:** Goals 3, 5, 6 (maintenance visibility, "why this number," trust assessment)
- **Screen:** Today / main card stack
- **What I expected:** Scroll down to see maintenance estimate, explanation of my target, feedback on partial days. Expected to see the rationale for "1,231 kcal" in 1–2 taps.
- **What happened:** "Getting Started" onboarding (2 of 3 complete) takes ~40% of viewport. Content below is inaccessible due to overlay; cannot scroll or close past it. The persona's load-bearing goal — "is this number trustworthy?" — cannot be answered without accessing hidden content. After 8 seconds of friction, persona would abandon the trust-assessment goal.
- **Severity guess:** P1 major
- **Screenshot:** `apps/mobile/screenshots/personas/lazy-partial-logger/2026-06-14/06-today-full.png`
- **Trust-impact:** yes — hidden explanation = hidden doubt. Persona cannot validate the estimate.

### Finding 3 — No visible feedback on partial/empty days, no tone assessment possible

- **Journey:** Goal 4 (app tone on missed days)
- **Screen:** Today / week strip
- **What I expected:** Tapping a partial day or seeing "day 7 was empty" with supportive language. Expected: "No worries — a few spotty days don't change much" (body-neutral). Feared: "You missed logging 3 days!" (shame).
- **What happened:** Week strip shows dots for logged days; no labeled feedback on partial or empty days visible. Content that would hold this feedback is blocked by onboarding card. Persona sentiment on tone is impossible to assess.
- **Severity guess:** P2 minor (affects trust assessment, but depends on access to the blocked content)
- **Screenshot:** `apps/mobile/screenshots/personas/lazy-partial-logger/2026-06-14/06-today-full.png`
- **Trust-impact:** yes — inability to see supportive framing = fear of body-shaming. Persona would assume worst-case.

### Finding 4 — "Fresh start" badge is vague and doesn't explain why target was set

- **Journey:** Goal 5 (understand why the target is 1,231 kcal)
- **Screen:** Today / main badge
- **What I expected:** "Fresh start" would link to or hint at the logic: "Based on 18 full days of logging, we estimate your maintenance at ~1,500 kcal. Your 1,231 target = 3% deficit."
- **What happened:** "Fresh start" is a label with no explanation. No methodology, no confidence level, no link to details. A non-reader persona (like this one) would see the number and react emotionally to it, not understand it.
- **Severity guess:** P1 major
- **Screenshot:** `apps/mobile/screenshots/personas/lazy-partial-logger/2026-06-14/06-today-full.png`
- **Trust-impact:** yes — vague badge + hidden explanation = persona concludes "the app doesn't know how it set this number, so neither do I"

## Linear

**New issues filed:**
- [ENG-1183](https://linear.app/suppr/issue/ENG-1183) — Getting Started card hides maintenance estimate and trust-critical explanation (P1)
- [ENG-1184](https://linear.app/suppr/issue/ENG-1184) — Fresh start badge lacks explanation of target methodology (P1)

**Existing issues commented on:**
- [ENG-1171](https://linear.app/suppr/issue/ENG-1171) — Mobile-web Today stacks modals + consent banner; confirmed on web, blocks FAB
- [ENG-953](https://linear.app/suppr/issue/ENG-953) — Surface expenditure (adaptive TDEE); critical for lazy-partial-logger's trust assessment

## Honest gaps

- **Web navigation limitations:** Playwright-driven web testing hit infrastructure challenges (dev server restarts); unable to fully exercise the logging flow (Goal 1) or scroll-and-read the below-fold content (Goals 3–5). This is a test harness gap, not a product gap.
- **iOS mobile testing blocked:** No per-persona test account provisioned yet (password for `gracehowse+lazylogger@outlook.com` not in environment). Mobile Path A would be more authentic for this persona's rapid tap-and-abandon behaviour, but requires Grace to provision the password in `.env.persona` or similar. (See RUNNER.md unblock note.)
- **Adaptive TDEE estimate state unknown:** Unable to confirm whether the persona's estimate has the R1 gate applied (partial days excluded) or is collapsed by them. This is critical to the persona's trust assessment but requires backend data inspection. Recommend checking: `adaptive_tdee_estimates.is_complete_week_only = true` and `_partial_day_count = 0` in the estimate used for the "Fresh start" badge.

## Persona decision

**Does this persona trust the app enough to keep using it casually?**

Conditional: Yes, *if* the hidden explanation is good and the tone is supportive. But right now, consent + onboarding overlays + vague "Fresh start" badge = "app doesn't respect my time" (violation of low-friction tolerance) → **persona abandons session after ~12 seconds**. 

The at-a-glance "1,231 LEFT" is excellent, but it's not enough to overcome the barrier to seeing *why* that number exists. This persona needs one of:
1. The explanation moved above the fold (no scrolling past the card)
2. The "Fresh start" badge to be clickable → popover with "Your maintenance is ~1,500; your target is 1,231 (3% deficit)"
3. The onboarding card to be dismissible / collapsed by default

**Recommendation:** This persona is the target for the adaptive TDEE R1 gate — they depend on visible, legible proof that the app handled their gaps well. Make that proof impossible to miss.
