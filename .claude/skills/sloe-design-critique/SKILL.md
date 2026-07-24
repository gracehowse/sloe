---
name: sloe-design-critique
description: Structured design critique of a Sloe surface — captures the real pixels, runs the token/spacing/type ratchets, then judges hierarchy, consistency, states, and accessibility. Use when asked to critique, review, or improve how a screen looks or feels on web or mobile.
---

# /sloe-design-critique

Structured design feedback on a real Sloe surface. Unlike a generic design critique,
this one **looks at the shipped pixels and runs the repo's own gates** before forming
an opinion — so findings are measured, not impressions.

## Usage

```
/sloe-design-critique <surface>
```

Examples: `/sloe-design-critique Today tab`, `/sloe-design-critique mobile paywall`,
`/sloe-design-critique the recipe import sheet on web`.

## What I need from you

- **The surface** — a tab, screen, sheet, or flow. If you don't name one, I'll ask
  rather than guess.
- **The stage** — *exploration* (judge the direction), *refinement* (full craft
  rigour), or *pre-ship* (blockers only). Default: refinement.
- **Focus** *(optional)* — "just the empty state", "only dark mode", "compare to
  MacroFactor".
- **Platform** *(optional)* — defaults to both, since parity is non-negotiable.

## How this runs

**1. Read the ground rules.** `.claude/agents/_project-context.md` — the PRIME RULE
(never restate a token value, cite its source), the design craft contract, the
severity ladder, and the suppression list. Findings already suppressed there are not
findings.

**2. Run the gates first — they are free and exact.**

```bash
npm run check:token-scale && npm run check:spacing-scale && npm run check:web-spacing-scale
npm run check:type-scale && npm run check:type-scale-mobile && npm run check:pressable-feedback
npm run check:anatomy && npm run check:web-radius
```

These answer the mechanical layer deterministically. Never hand-census what a ratchet
already measures — and if your eye disagrees with a ratchet, the ratchet is right.

**3. Capture the pixels. Not optional.**

Load **`suppr-ios-sim-testing`** for the simulator or **`suppr-web-testing`** for web
and mobile-web, and capture the surface yourself. **Never ask Grace for screenshots.**

A verdict-grade wall covers: default state, **scrolled**, **populated account**, key
**sheets/modals**, **dark mode**, and the empty + error states. Top-of-screen captures
of a sparse account do not support a verdict — say so and stop rather than guessing.

**4. Delegate the depth.** Dispatch the `design` agent (mode: CENSUS then CRITIQUE)
and, if the surface involves body, identity, imagery, or any interactive control,
`inclusive-design`. Run them concurrently.

**5. Judge what a template can't fake.** Cream + serif + warm accent is the default
look of AI-generated UI — its presence proves nothing. Premium is earned in
photography, ring and data-viz craft, motion, haptics, and measured spacing rhythm.

## Output

```markdown
## Design critique: [Surface] · [stage]

**Coverage:** [captures taken — states, modes, account fullness]. [Anything you
couldn't capture, and why.]
**Gates:** [which ratchets ran, and their result]

### First impression
[What the eye lands on first, and whether that's correct. The emotional read. One
sentence on the biggest opportunity.]

### What's working — preserve this
- [Specific thing that is genuinely good, and why it works]
- [Another]

### Findings
| Finding | Sev | Conf | Recommendation |
|---|---|---|---|
| [Specific, measured — "the CTA competes with the nav", not "layout is confusing"] | [BLOCK/P0–P3] | [high/med/low] | [The actual fix, in tokens] |

### Visual hierarchy
- **Eye lands first on:** [element] — [correct?]
- **Reading flow:** [how the eye moves]
- **Emphasis:** [are the right things loud?]

### Consistency
| Element | Nearest sibling | Divergence | Call |
|---|---|---|---|
| [chip/row/header] | [where else it renders] | [what differs] | [unify / document why different] |

### States
[pressed · hover · focus-visible · disabled · loading — present or missing, per
interactive element. Silent success/failure is a finding, not polish.]

### Accessibility
[Contrast on key text, touch target sizes, screen-reader labelling, reduced-motion.
Note: the web axe helper disables the contrast rule — measure it yourself.]

### Priority
1. **[Highest-leverage change]** — [why, and the token-level fix]
2. **[Second]** — [why]
3. **[Third]** — [why]
```

## Severity

Use the ladder in `.claude/agents/_project-context.md`. Do not invent a local scale.

## Notes

- **Report what works before what's broken.** An agent that only finds problems will
  manufacture them. "Nothing above P2 here" is a valid, valuable result.
- **Match the stage.** Don't file P2 craft debt on an exploration sketch.
- **Challenge decisions when evidence warrants.** A documented decision blocks
  re-filing a settled finding, not a new evidenced challenge — including to Grace's
  own calls. Name the decision, show what changed, route it to her as a decision item.
- The canonical prototype is `docs/ux/redesign/v3/Sloe-App.html`. The Figma is dead;
  `docs/ux/claude-design-bundles/` is historical and encodes a system the product has
  left behind — do not audit against either.
