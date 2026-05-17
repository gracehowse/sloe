# Tare — Brand Asset Pack

Hand-off package for engineering. Drop the SVGs into your asset directory and
reference them as image sources. The bowl mark is the primary identifier; the
"TARE" wordmark always uses **Inter Medium (500)**, uppercase, with 0.42em
letter-spacing.

---

## Files

### Mark (the bowl, on its own)
- `mark.svg` — ink (#14141a) on transparent
- `mark-white.svg` — cream (#f1ebdf) on transparent

Use the **mark on its own** for: app icons (with a colored ground —
see `app-icon-*.svg`), favicons, social avatars, in-app loading states,
and any context smaller than ~48px where the wordmark wouldn't be legible.

### Wordmark (the word, on its own)
- `wordmark.svg` — ink
- `wordmark-white.svg` — cream

Use the **wordmark on its own** when the mark is already established in the
context (e.g. inline mentions, breadcrumbs, footer text). It is set in
**Inter Medium 500, uppercase, letter-spacing 0.42em.** If Inter isn't
available the SVG falls back to system sans.

### Lockup (mark + wordmark together)
- `lockup.svg` — horizontal, ink
- `lockup-white.svg` — horizontal, cream
- `lockup-stacked.svg` — mark above wordmark, ink
- `lockup-stacked-white.svg` — mark above wordmark, cream

Use the **horizontal lockup** at the top of every app screen, the website
header, and on marketing surfaces. Use the **stacked lockup** for
splash/loading screens, packaging hangtags, and any contained square
moments.

### App icon (Apple App Store, iOS home, macOS)
- `app-icon-ink.svg` — 1024×1024, ink ground + cream bowl. **Primary.**
- `app-icon-cream.svg` — 1024×1024, cream ground + ink bowl. Alternate.

Both are flat full-bleed squares — iOS applies the squircle mask
automatically. For Apple Asset Catalog, export PNG at: 1024, 180, 167,
152, 120, 87, 80, 76, 60, 58, 40, 29.

---

## Colors

| Role             | Hex        | Use                                |
|------------------|------------|------------------------------------|
| `ink`            | `#14141a`  | Primary type, mark on light        |
| `cream`          | `#f1ebdf`  | Primary surface, mark on dark      |
| `night`          | `#0e0d0b`  | Dark-mode surface                  |
| `stone`          | `#a89a87`  | Hairlines, supporting text         |
| `bronze`         | `#8e6a3a`  | Single editorial accent, sparingly |

All tokens are also in `tokens.css` and `colors.json`.

---

## Type

- **Sans (everything):** Inter — Medium 500 for the wordmark and labels,
  Regular 400 for body, 600/700 for hero numbers and titles.
- **Serif (optional editorial moments only):** Newsreader.

The wordmark **never** mixes with any other treatment. Always Inter 500,
uppercase, 0.42em tracking, kerning enabled. Do not use the wordmark in
italic, in any other weight, or with any other font.

---

## Clear space

Minimum clear space around the lockup = the height of the mark on all
four sides. Minimum reproduction size for the lockup = 80px wide. Below
that, use the mark alone.

---

## Don'ts

- Don't recolor the mark in anything other than ink, cream, or one of the
  approved accent palette.
- Don't apply drop shadows, gradients, or 3D effects.
- Don't rotate, skew, or stretch.
- Don't outline the bowl strokes with a different color (the inner ring is
  thinner than the outer — that's the only weight relationship that exists).
- Don't crowd the lockup against other marks.

---

## Questions

These assets are SVG. Open them in any vector editor (Figma, Sketch,
Illustrator) to inspect. For raster handoff (PNG, PDF) export at @1x,
@2x, @3x as needed.
