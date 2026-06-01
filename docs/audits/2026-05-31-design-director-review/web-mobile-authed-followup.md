# Authed mobile-web — design-director follow-up (2026-05-31)

Fills the web-mobile coverage hole from the main review. The authed mobile-web app was
re-captured with a fresh session (13 real surfaces at 390px) after the original pass came
back ~40% login-walls. No mobile-web app-gate exists in code — the holes were a stale-session
capture artifact.

## Verdict — Good identity, Generic depth, dragged to Prototype by chrome breakage

The signature **carries** from iOS to mobile-web (cream canvas, single blue, pill chips,
macro-chip recipe cards, lucide glyphs, the Progress hero ring). Import, Create, Fasting,
Discover are genuinely on-brand. **But the frame around the screens is broken**: every authed
surface with the bottom nav also shows a Next.js dev "1 Issue" error badge on the tab bar, a
cookie-consent bar wedged above the nav (text clipped), and Today opens behind a full-screen
weekly check-in modal. The screens are fine; the chrome layer collapses the first impression.

## Parity vs iOS
- **Matches:** palette, signature, calm voice, Progress amber ring (intentional, ENG-616).
- **Drifts flatter:** mobile-web uses `border-border/70` hairline borders where iOS uses soft
  elevation — same Generic-depth floor, expressed via borders instead of shadows. One elevation
  token (ENG-795) fixes both platforms.
- **No web win-moment analog** for commit actions (per `feedback_mobile_decisions_apply_to_web`).
- **Structural divergence:** `/plan` renders a full meal-plan UI; `/planner` dead-ends to a
  "Your meal plan lives in the iOS app — Get the app" wall — on the web platform itself.

## Scorecard — authed mobile-web
| Lens | Tier |
|---|---|
| Identity | Good |
| Palette & colour | Good |
| Consistency | Generic |
| Material & depth | Generic |
| Motion | Prototype |
| Delight (win moments) | Prototype |
| **Overall** | Generic, dragged to Prototype by chrome breakage |

## Top issues → Linear
- **P1** Next.js dev "1 Issue" error badge on tab bar across all authed surfaces — indicates a
  real runtime/build error; harness ran against a dirty build. → ENG-804
- **P1** Notifications header / "Mark all read" overlap at 390px (`NotificationsCenter.tsx:17`). → ENG-803
- **P1** Mobile-web chrome occludes content + nav at 390px — cookie-consent bar clips its own
  text and collides with the tab bar (`CookieConsent.tsx`). → ENG-802
- **P1** Weekly check-in modal is the cold-open blocker on Today (web + mobile) — demote to a
  dismissible card. → ENG-805
- **P2** `/plan` vs `/planner` divergence — planner shows a "get the app" wall on web. → ENG-806

## Phantom correctly dropped
Progress hero ring rendering **amber at >100%** is **intentional** (`progress-hero-metric.tsx:38-41`,
ENG-616, canonical 2026-05-22 v2 — over-budget is a gentle nudge). The destructive-red carve-out
applies only to the **Today calorie ring**, a different component. Do not re-flag.

## Remaining mobile-web coverage gaps (declared)
No authed mobile-web captures of: the Log sheet, paywall, recipe-detail, cook-mode, onboarding,
or an un-modalled Today. Those remain uncovered at 390px.
