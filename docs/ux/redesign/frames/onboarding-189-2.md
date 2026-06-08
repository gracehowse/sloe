# Onboarding — goal step — Figma frame `189:2` spec

**Frame PNG (READ FIRST):** `docs/ux/redesign/frames/onboarding-189-2.png`
Source: Figma `B3UdOFup7ITersgNuoXh0l` node `189:2`. This is ONE step (goal selection) — apply the same chrome/treatment to the whole onboarding flow.

## Tokens
White/cream bg · plum `#3B2A4D` (progress fill, selected border + check, headline) · body `#6A6072` · clay `#C8794E` (Continue CTA). Newsreader for the question; Inter for options/subtitle.

## Layout (top → bottom)
1. **Top bar:** back chevron + **segmented progress bar** (4 segments here; first filled plum, rest faint lilac). Use the real step count.
2. **Question** — "What brings you to Sloe?" (Newsreader ~28px plum, centered).
3. **Subtitle** — "We'll tailor everything to you." (Inter grey, centered).
4. **Option list** — each option = full-width row: round **food-image thumbnail** (left, ~56px) + label (Inter ~16px `#221B26`) + (when selected) a plum **checkmark** circle (right). **Selected option** = subtle cream fill + **plum border**. Options here: "Lose weight while still eating what I love" (selected) / "Build muscle" / "Eat healthier at home" / "Just track what I cook".
5. **"Continue"** — clay fill, white, full-width rounded-full, bottom.

## Biggest deltas vs current app
Capture the current onboarding (route varies — `/onboarding`; on iOS it's the post-auth flow) and diff. Match: the segmented plum progress bar; the Newsreader question + grey subtitle; the option rows with round food thumbnails + plum-border/checkmark selection; the clay Continue CTA. Apply the SAME chrome (progress bar + serif question + subtitle + clay CTA) to every onboarding step (goal, pace, diet, allergies, reveal, etc.).

## Preserve (wired — never drop)
Step sequencing + back nav, the real options per step + their persistence (onboarding-seed write path — see persistence-path guardrails), progress indicator accuracy, the reveal/summary step, any validation (e.g. pace floor soft-warn). Do not break the canonical `/onboarding` flow.
