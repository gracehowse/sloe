# Design craft contract — census before verdict, write-time discipline

**Date:** 2026-06-09
**Status:** Resolved
**Area:** Design process / review fleet / both platforms
**Trigger:** Grace shared github.com/Trystan-SA/claude-design-system-prompt (a
public reconstruction of the system prompt behind Claude Design — the tool that
generated our canonical prototype bundles at `docs/ux/claude-design-bundles/`)
and challenged the review fleet against it.

## Problem

The review fleet repeatedly passed surfaces Grace then faulted by eye. The
2026-06-09 design-director run called light mode "Premium, knocking on
Flagship"; Grace's response: "there are still many inconsistencies, spacing
problems etc." — and she was right.

Comparing our fleet against the Claude Design prompt's logic exposed the cause
as **method, not topic coverage**. Our agents mention spacing/consistency/
states, but:

1. **Verdict-first, census-never.** design-director led with a tier verdict
   and was told to root-cause rather than list instances — so value-level data
   (every off-scale gap, every near-duplicate treatment) was never collected,
   and nothing could contradict the narrative. The Claude Design review skills
   run the opposite order: *"report every issue found, including uncertain and
   low-severity ones… Coverage is the agent's job; filtering happens at
   aggregation"* — and issue no tier verdicts at all.
2. **Impressions where falsifiable checks belong.** "Is rhythm consistent?"
   can be answered yes without measuring. "Is this padding in
   {4,8,16,20,24,32,40}?" cannot. We had already learned this twice (contrast
   audit, web type-scale gate) without generalising it.
3. **Zero write-time discipline.** The Claude Design prompt is a *generator*
   prompt — discipline applies when pixels are first written. Our discipline
   lived ~100% in review agents; the sessions actually writing UI code
   (Claude + Cursor) had no token rule, no scales, no states requirement in
   any CLAUDE.md. Sweeps mopped while the tap ran.
4. **visual-qa — the agent owning spacing/consistency — was the least
   equipped**: no procedure, no measurement protocol, no Bash (couldn't even
   capture), passive "request screenshots" posture.

## Decision

Adopt the method, keep our grounding. Five changes, all shipped 2026-06-09:

1. **`.claude/agents/_project-context.md` — new "Design craft contract"**
   read by every agent at step zero: canonical scales (Spacing
   4/8/16/20/24/32/40, Radius 4/6/8/12, `Type` ramp, tokens-only colour,
   one-card elevation), **census-before-verdict** rule, verdict-grade capture
   requirements (scrolled + sheets + dark + populated), the **near-duplicate
   rule** ("identical, or deliberately different and documented"),
   interaction-state completeness, and the editorial-warm convergence
   calibration note (cream+serif is now the AI-default look — premium must be
   earned in photography / ring craft / motion / haptics / spacing rhythm,
   not the shell).
2. **`visual-qa` rebuilt** as a forensic, measuring agent: +Bash, captures
   its own pixels, six-pass protocol (spacing census, token census,
   near-duplicate hunt, state inventory, alignment/overflow, clutter),
   coverage contract (every finding incl. low-confidence, with severity +
   confidence; filtering at aggregation), value-level output
   (current → correct, file:line), instances AND root causes — never roots
   instead of instances. No tier verdicts.
3. **`design-director` patched**: tier verdicts require a verdict-grade wall
   + attached censuses, else the scorecard is **withheld — census
   incomplete**. Consistency matrix must be census-backed.
4. **`ui-critic` patched**: spacing/type findings cite measured vs canonical
   values; tier is **provisional** unless value-level checks + scrolled/dark/
   empty states were seen; full state-set check; 5-second test.
5. **Write-time discipline** added to root `CLAUDE.md` ("UI write
   discipline") and `apps/mobile/CLAUDE.md`: tokens only, scales, states ship
   with the element, one filled CTA, elevation rule, same-element-same-
   treatment. Binding on every UI line whoever writes it (Claude or Cursor).

Follow-up (ticketed): generalise the contrast-audit/type-scale-gate pattern to
a **programmatic spacing + token census** so the scale rules are enforced by
CI, not agent eyeballs. Sibling of ENG-1002 (mobile type-scale gate).

## What we deliberately did NOT adopt

Per `feedback_conformity_trap` — our fleet beats the repo on grounding, and
that stays:

- **Pixel-grounding** (HEAD-verified captures, read every PNG) — the repo
  reviews code/HTML; for RN that misses rendering truth. Ours is stronger.
- **Live competitor calibration** (Mobbin pulls, named comparables, dated
  references) — absent from the repo entirely.
- **Carve-outs + differentiator guardrails** (ring colour mapping, locked
  components, defended choices) — the repo would sand these off.
- **Its font opinions** (e.g. "question Fraunces as a silent default") — our
  serif/type choices are committed brand decisions, not silent defaults.
- **Production skills** (wireframe / make-a-deck / make-tweakable) — built
  for greenfield artifact generation, not a mature codebase.

## Consequences

- The next full review (fresh-eyes, per the 2026-06-09 handoff queue #1) runs
  under census-before-verdict; its spacing-forensics and consistency passes
  are now durable agent behaviour, not one-off prompt text.
- Tier verdicts get rarer and slower. That is the point — a withheld scorecard
  is honest; a narrative "Premium" that Grace refutes by eye is not.
- Write-time rules bind Cursor too (it reads CLAUDE.md), closing the loop the
  review fleet could never close alone.
