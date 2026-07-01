# 2026-07-01 — Full-sweep decisions (Grace, via sweep triage)

Context: the 2026-07-01 full-product orchestration sweep (`docs/planning/2026-07-01-full-sweep-report.md`) surfaced four decision items. Grace resolved all four on 2026-07-01.

## 1. Coach AI gating — Pro-gate the AI calls only

Free users keep the Coach screen with the deterministic template narrative and template answers; the Claude re-phrasing path (`/api/nutrition/coach*` AI branch) and AI answers become Pro-only. Matches the paywall's "AI coach" promise, caps AI spend during the viral window, keeps the screen itself as a free-tier retention hook. Supersedes the ungated state ENG-1240 shipped with.

## 2. Over-budget calorie ring — amber re-ratified (red lock RETIRED)

The 2026-04 "over = destructive red" carve-out is **retired**. The shipped warm coral/amber arc + amber numeral is now the locked mapping, deliberately: user research in this sweep (diet-culture exhaustion; "red numbers, guilt cycles" as the #1 refugee complaint; MacroFactor's no-red posture) outweighs the at-a-glance-severity argument. Over-budget signals product-wide are now uniformly amber — the calorie-ring red carve-out no longer exists. Follow-up: update `_project-context.md` + memory + tokens naming so red is never "enforced back" by a future conformance pass. Empty/under mapping unchanged (gradient / success green).

## 3. Coach screen placement — keep it; B9 formally reversed; persistent entry

The ratified B9 "no unified Coach screen" (2026-06-11) is **formally reversed** — ENG-1240's unified screen stays. Coach gets a small always-present labelled entry (chip in the Today hero + web sidebar item) that works in every state — over budget, all logged, fasting — replacing the conditional deficit-line-only entry that vanished exactly when the user needed it (verified V6/V23). Still gated by `coach_screen_v1`.

## 4. Sweep filing — everything goes to Linear

All ranked actions + the mechanical batch filed as ENG issues (launch-blocker labels where relevant); already-ticketed ops/legal blockers (GROW-45/47/48/57, ENG-33) linked, not duplicated.

## 5. Empty/under hero ring — deepen the gradient (evening gap-closure)

Measured: cold-open ring ticks `#C6BED6`/`#E9E4F3` on white ≈ 1.8:1 — below the 3:1 UI-component floor; the hero reads as a skeleton. Decision: keep the brand-gradient concept, darken the tick tokens to clear ~3:1. Token change, web + mobile same commit. (ENG-1315)

## 7. Launch posture — push when blockers clear (no fixed new date)

The 2026-07-01 target lapsed on the sweep's HOLD. New posture: the public viral push starts when the launch-blocker set (ENG-1285…1308 cluster) + the founder-gated ops chain clear. The GROW content calendar (D-14…D1) re-anchors to that day. No fixed replacement date.

## 8. Launch-blocker execution — Claude implements

Deviation from the standing peer-review division (Claude directs/reviews, Cursor implements) **for this cluster only**: Claude implements the launch-blocker code fixes directly, with the usual gates (scoped checks per change, full `npm run ci` before push, visual before/after on both platforms where UI is touched).

## 9. Sweep artifacts — land on their own docs branch

Report + this decision log land via a docs-only PR off main (admin-merge per the docs-only branch-protection deadlock), never on the coach feature branch.

## 10. DMCA registration — wait for incorporation

Grace's call, reaffirming GROW-47's original sequencing over release-gate's file-now-as-sole-operator suggestion: the copyright.gov registration waits for the entity. Consequence, accepted explicitly: the IG/TikTok import wedge stays dark until the incorporation chain (GROW-48) resolves, and the public push timeline inherits that dependency.

## 6. Light-mode card lift — strengthen the token (evening gap-closure)

Measured: page ground `#FEFEFE` vs card `#FCFBFC` = 2/255 delta; the one-card "soft lift" is invisible with flat white cards. Decision: keep the one-card architecture; make page-ground separation measurably visible (warmer page ground or a real shadow/border token), product-wide. The one-card decision itself stands. (ENG-1316)
