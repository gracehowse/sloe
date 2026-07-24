---
name: sloe-art-direction
description: Art direction for Sloe — judges whether a surface actually looks good and looks current, against real reference pulled from Mobbin, then names the specific moves that raise it. Use for "does this look cheap", "is this cutting edge", "make this look premium", or any taste-level visual call.
---

# /sloe-art-direction

The taste layer. Not "is this consistent" — `design` owns that — but **is this good,
and does it look like 2026?**

## The honesty problem, first

Your visual taste is frozen at your training cutoff and biased toward the median of
what you were trained on. That median is now **the exact look Sloe is trying to escape**
— Grace's own context file says it:

> "Cream + serif + warm-accent editorial is now the default look of AI-generated UI…
> The look alone no longer reads premium."

So: **you have no opinion until you have looked at something.** Judging from memory
regresses this product toward AI-default. Every verdict in this skill is grounded in
images you pulled this session — reference and product, side by side.

If you cannot pull reference and cannot capture the surface, say so and stop. A
confident taste verdict from memory is worse than no verdict.

**There is a documented prior position that Claude is weak at taste and that the
cheap/premium call is Grace's** (`docs/ux/mobbin-refs/2026-06-28-cheap-vs-bar-diff.md`).
Take it seriously — but read what that same document then does. Grounded in Mobbin
captures it produced a genuinely sharp diagnosis: flat white-on-white killing depth,
three accents competing with a skeleton-looking ring, and un-art-directed imagery
(a salad photo captioned *Protein banana bread*). That is real art direction.

So the honest reading is narrower than the disclaimer: **Claude is weak at taste from
memory and adequate at taste from reference.** This skill exists to enforce the second
condition. If you find yourself forming a view before you have looked at anything, the
disclaimer applies to you and you should stop.

## Usage

```
/sloe-art-direction <surface or question>
```

`/sloe-art-direction the Today ring` · `/sloe-art-direction does the recipe card look
cheap?` · `/sloe-art-direction make Progress feel premium`

## What I need from you

- **The surface, or the feeling.** "The ring looks cheap" is a better brief than "review
  Today" — a named discomfort gets a sharper answer.
- **Ambition.** Fix this screen, or set a direction the rest of the app follows?
- **Anything locked** — a decision or component I should treat as settled. I can still
  challenge it with evidence, but I'll route it rather than redesign around it.
- **Comparables you admire**, if you have them. Otherwise I'll pick and show you.

## How this runs

### 1. See Sloe's actual pixels

Load `suppr-ios-sim-testing` or `suppr-web-testing` and capture the surface — populated
account, scrolled, dark mode, and the empty state. **Never ask Grace for screenshots.**
A prototype reconstruction is not the app; judge only what shipped.

### 2. Pull real reference — Mobbin first

Use the Mobbin MCP (`search_screens`, `search_flows`, `search_sections`). **Look at the
images**; never judge from the metadata. Cite each screen you reference as a markdown
link to its `mobbin_url` so Grace can open it.

Pull **two sets**, and keep them separate:

- **In-category** — what nutrition/health trackers do with this surface. Establishes the
  table stakes and, more usefully, the clichés to avoid.
- **Out-of-category** — the same *job* solved by a better-designed product in another
  category. Ring/arc craft from a fitness or sleep app. Dense data from a finance app.
  Editorial imagery from a cooking or travel app. **This is where the leverage is.**
  Copying nutrition apps produces a nutrition app; Sloe's documented rule is never to
  anchor on trackers alone.

If Mobbin is unavailable, fall back to WebFetch on App Store listings and product sites
— and say that you did, because the reference is weaker.

### 3. Run the slop test

Before anything else, ask: **would this be indistinguishable from a screen an AI
generated?** The 2026 tells:

- Cream/oat ground + serif display + terracotta accent (the current default)
- Purple-to-blue gradients; glassmorphism as decoration
- Uniform radius on every element regardless of size
- Emoji standing in for iconography
- Evenly-spaced card stacks with no rhythm or hierarchy
- Inter (or a geometric sans) at every weight, doing every job

Sloe already sits inside the first of these by decision. That's not automatically wrong
— but it means **the look is not doing the work**, so premium has to be earned in the
layers below. Judge those hardest.

### 4. Judge the craft that separates premium from generic

These are falsifiable. Check them against the captures.

**Type**
- Tracking tightens as size grows. Display numerals set at body tracking read amateur.
- **Tabular numerals anywhere a number updates** — otherwise digits jitter on change.
- In a serif/sans pairing, x-heights should be close or the pairing reads accidental.
- Same job → same treatment. Two labels doing one job at different weights is a bug.

**Colour**
- Neutrals should be tinted toward the brand hue, not pure grey. Untinted grey borders
  on a warm ground is the single most common cheap tell.
- Pure `#000` / `#fff` for text is harsh — near-black and near-white read better.
- Dark mode is not an inversion. Elevation inverts (higher = lighter), saturation must
  drop, and pure-black grounds crush OLED detail.
- Chroma discipline: one accent doing the work beats three competing.

**Depth**
- **One material system.** Shadow *or* border *or* fill-contrast — picking all three is
  what makes a card look like a bootstrap default. (Sloe's ruling is flat + hairline on
  page-ground; read the current rule, don't assume.)
- Concentric radii: an inner radius should equal the outer radius minus the padding.
  Get this wrong and nested cards look glued on.
- Radius should scale with element size. One radius everywhere is a tell.

**Data-viz — the highest-leverage surface in this product**
- Round line-caps on arcs and rings, never butt caps.
- Gradients follow the arc's sweep, not a vertical light→dark default.
- Track contrast: too low and the ring floats, too high and it reads as a second value.
- Kill the chart-library default look — gridlines, legends, axis labels on every tick.
  Label the two points that matter and delete the rest.
- The number is the hero; the chart is its evidence. Most tracker apps invert this.

**Motion**
- Things grow from where they were tapped. Origin-less scale-ins read cheap.
- Duration bands: micro-feedback fast, transitions medium, celebratory slower. One
  duration for everything is a tell.
- Spring for anything that follows a finger; ease-out for anything that arrives.
- Honour `prefers-reduced-motion`.

**Imagery** — central here, since food is the product
- Consistent crop ratio, warmth, and shadow treatment across every card, or the grid
  reads as clip-art.
- Real food photography beats illustration for appetite appeal; inconsistent photography
  is worse than none.

**Restraint**
- The most premium screens have *fewer* elements, not more. Before adding, ask what can
  be deleted.
- Generous space has rhythm — related things tight, unrelated things far apart. Uniform
  spacing everywhere is the absence of a decision, not minimalism.

**Haptics** (mobile)
- Weight matched to significance: selection ticks light, commits medium, win moments
  heavier. Uniform haptics are noise.

### 5. Be specific and generative

- **"The CTA competes with the nav"**, not "the layout feels off."
- Every criticism carries the move that fixes it, in tokens — and if the token doesn't
  exist, say which one to add.
- Name what you'd *delete*. It's usually the highest-leverage note and the one nobody
  gives.
- Say what's genuinely good and why, per "Report what is working" in
  `.claude/agents/_project-context.md`. If a surface is strong, say so — inventing
  problems to look rigorous is the failure mode of this whole skill.

### 6. Stay inside the rules while pushing on them

Tokens, scales, and elevation come from `.claude/agents/_project-context.md` and the
files it points at — **read them, never restate their values.** If the right answer
needs a token that doesn't exist, propose adding it.

A documented decision blocks re-filing a settled finding; it does not block a new,
evidenced challenge — including to Grace's own calls. Name the decision, show the
reference that undermines it, route it to her as a decision item. Never silently
redesign around a decision.

## Output

```markdown
## Art direction: [surface]

**Captured:** [what you shot — states, modes, account fullness]
**Reference pulled:** [N in-category, N out-of-category, all as mobbin_url links]

### The read
[Two or three sentences. Does it look good? Does it look current? What is the single
biggest thing standing between this and the bar? Be direct — this is the section Grace
actually reads.]

### Slop test
[Pass / Fail, and which tells are present. If the look alone isn't earning premium, say
which layer has to.]

### Against reference
| What | Sloe today | [App] ([mobbin link]) | The gap |
|---|---|---|---|
| [ring / card / type / imagery] | [what ours does] | [what theirs does] | [why theirs reads better] |

### Working — keep this
- [Genuinely good, and why it works]

### The moves
1. **[Highest-leverage change]** — [the specific treatment, in token names. What it
   fixes and why it's first.]
2. **[Second]** — [...]
3. **[Delete this]** — [what to remove, and what it buys]

### Direction
[Only if asked to set one: the through-line the rest of the app should follow, in a
sentence a person could apply to a screen you haven't reviewed.]

### Couldn't check
[States you couldn't capture, reference you couldn't pull. Mark affected calls low
confidence.]
```

## Notes

- **`design` and this skill are different jobs.** `design` asks "is this internally
  consistent and complete?" — census, states, near-duplicates, tokens. This asks "is it
  good?" Run `design` for hygiene; run this for taste. When both are wanted, run the
  census first so taste isn't distracted by mechanical noise.
- Severity, when you need it, comes from the ladder in
  `.claude/agents/_project-context.md`.
- The canonical prototype is `docs/ux/redesign/v3/Sloe-App.html`; the type-role system
  is in `docs/ux/redesign/v3/DESIGN-CONSTITUTION.md`. Prior direction work lives in
  `docs/ux/mobbin-refs/` — read `2026-06-28-cheap-vs-bar-diff.md` before re-deriving
  what was already settled.
