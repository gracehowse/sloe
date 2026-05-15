# HTML prototypes — premium-sweep-v2 G3.5 gate

**Purpose:** render each approved proposal as a static HTML prototype
so Grace can red-line *visuals* before any production code lands.
Added 2026-05-14 after the 4-reverts retro — typed proposals read
differently from rendered ones; prototypes catch the gap.

## Layout

```
prototypes/
├── README.md            (this file)
├── _shared/             (CSS source-of-truth for the inline blocks;
│                         do NOT link from prototype HTML — see below)
│   ├── tokens.css       (browser-safe extract of theme.css)
│   ├── iphone-frame.css (mobile iPhone bezel/notch CSS)
│   └── prototype.css    (before/after toggle, side-by-side layout)
├── web/
│   ├── P0/              (~25 P0 web surface prototypes)
│   ├── P1/
│   └── P2/
└── mobile/
    ├── P0/
    ├── P1/
    └── P2/
```

**Important — inline the CSS, don't `<link>` it.** Tried external
`<link rel="stylesheet">` to the `_shared/` files first; browsers
served them but `file://` cache + path-resolution quirks broke the
render unpredictably. The fix that works reliably: copy the relevant
`_shared/` CSS into a `<style>` block at the top of each prototype
HTML. The `_shared/` files are the source of truth for the patterns;
each prototype is fully self-contained so it's double-clickable from
Finder with zero external dependencies. Reference example:
[`mobile/P0/paywall.html`](mobile/P0/paywall.html).

## Naming convention

`<surface-slug>.html` — surface slug is taken from the proposal table's
`Surface` column, kebab-cased. Examples:

- `prototypes/web/P0/pricing.html`
- `prototypes/web/P0/signup.html`
- `prototypes/mobile/P0/paywall.html`
- `prototypes/mobile/P0/today-first-render.html`

If a surface has multiple proposals affecting different elements, the
single prototype file shows all proposed changes for that surface in
one render (numbered to match the proposal row #).

## Prototype structure

Every prototype HTML file follows this skeleton:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Suppr — &lt;surface&gt; prototype</title>
    <link rel="stylesheet" href="../../_shared/tokens.css">
    <link rel="stylesheet" href="../../_shared/prototype.css">
    <!-- mobile only: -->
    <!-- <link rel="stylesheet" href="../../_shared/iphone-frame.css"> -->
  </head>
  <body>
    <header class="prototype-header">
      <h1>&lt;surface name&gt; — &lt;web|mobile&gt;</h1>
      <p class="meta">Proposal rows: #N.1, #N.2, #N.3</p>
      <nav>
        <button data-view="before">Before</button>
        <button data-view="after" aria-current="true">After</button>
        <button data-view="side-by-side">Side-by-side</button>
      </nav>
    </header>
    <main class="prototype-canvas">
      <section class="state state--before">
        <!-- 1:1 reproduction of the captured `before` state -->
      </section>
      <section class="state state--after">
        <!-- Rendered proposed "after" state with all numbered changes -->
      </section>
    </main>
    <aside class="prototype-notes">
      <h2>What changed</h2>
      <ul>
        <li><strong>#N.1 SUBTRACT</strong> — Removed X because it
            duplicated Y.</li>
        <li><strong>#N.2 TIGHTEN</strong> — Tightened spacing on Z
            from 16px → 12px.</li>
        <li><strong>#N.3 NEW</strong> — Added foo (justified by:
            existing element was empty; this fills the gap without
            duplicating anything).</li>
      </ul>
      <h2>DCs touched</h2>
      <p>DC4 — paywall trust chips. The proposed change preserves the
         3 explicit guarantees and adds inline placement adjacent to
         the price (allowed borrow from Stripe Checkout per DC4 ref).</p>
      <h2>Refused borrows considered</h2>
      <p>We considered adopting Calm's "No price hikes ever" 4th chip
         but defer (per Grace not having committed long-term).</p>
    </aside>
  </body>
</html>
```

## Fidelity bar

- **Web prototypes:** use the real Tailwind token set + shadcn
  primitives. The prototype should be visually indistinguishable from
  what Grace would see in `npm run dev` if the change shipped. Fonts,
  spacing, colours, radii match the live design system.
- **Mobile prototypes:** HTML/CSS approximation inside an iPhone
  frame. Doesn't have to be pixel-perfect to the native rendering,
  but must capture: typography scale, colour tokens, layout
  hierarchy, key interaction affordances. State changes (tap, log,
  scroll position) can be represented as separate `.state` blocks.

## What the prototype is NOT

- **Not interactive.** Buttons don't navigate. Forms don't submit.
  The view toggle (Before / After / Side-by-side) is the only working
  control.
- **Not a Storybook entry.** This is throwaway HTML scoped to the
  sweep. Storybook entries live in the codebase under
  `apps/<platform>/stories/` and have a different review cadence.
- **Not the final design.** It's the *G3.5 visual check* — does the
  proposed change feel premium when rendered? If yes, Grace approves
  and S3 implementation translates the prototype into real code. If
  no, the row goes back to `proposed` for re-thinking.

## How Grace reviews

For each prototype file in a bucket's prototypes folder:

1. Open in browser (drag-drop or `open <file>.html` in macOS).
2. Toggle Before ↔ After ↔ Side-by-side. The state buttons are the
   only working controls.
3. Read the `<aside class="prototype-notes">` block — what changed,
   DCs touched, refused borrows considered.
4. Approve in the proposal table: mark `Status` from `approved` →
   `prototype-validated`. Reject: mark row `rejected` with a 1-line
   reason.

Items that reach `prototype-validated` are eligible for S3
implementation. Items that don't reach `prototype-validated` cannot
be touched by S3 code.
