# Fasting — Figma frame `305:2` spec

**Frame PNG (READ FIRST):** `docs/ux/redesign/frames/fasting-305-2.png`
Source: Figma `B3UdOFup7ITersgNuoXh0l` node `305:2`. (Legacy app skin is indigo — migrate fully to Sloe.)

## Tokens
Cream `#F6F5F2` · plum `#3B2A4D` (active preset pill) · body `#6A6072` · clay `#C8794E` (ring arc, active stage, End-fast CTA, Edit links) · lilac ring track. Newsreader for "Fasting", the big timer, ring eyebrow; Inter labels.

## Layout (top → bottom)
1. **Top bar:** back chevron + **"Fasting"** (Newsreader, centered) + "..." (right).
2. **Preset pills:** `16:8` (active = plum fill, white) / `18:6` / `OMAD` (unselected = cream, grey). (All five presets exist per ENG-922 — show the configured set; active filled plum.)
3. **Progress ring** — large, **clay arc on lilac track**: centered flame icon + "FAT BURNING" (clay eyebrow, uppercase) + **"9:54"** (Newsreader ~56px) + "elapsed · 6:06 left" (grey).
4. **FASTING STAGES card** (cream rounded-24): "FASTING STAGES" eyebrow + a horizontal **stage bar**: Fed → **Fat burning** (active, clay label + filled dot) → Ketosis → Deep, with a clay progress line through reached stages + dots at each.
5. **Started / Goal card** (cream rounded-24, 2 columns split by a hairline): STARTED "10:00 PM" + "Edit" (clay) | GOAL "2:00 PM" + "Edit" (clay).
6. **"End fast"** — clay fill, white, full-width rounded-full.
7. **Coach line** — italic Newsreader quote, centered: e.g. "You're in the fat-burning window — a good time to keep things light."

## Biggest deltas vs current app
Capture current `/fasting` (deep link `suppr:///fasting`) and diff. The legacy skin uses indigo — migrate to: clay ring arc on lilac track; plum active preset pill; the FASTING STAGES bar (Fed/Fat burning/Ketosis/Deep); the Started/Goal split card with clay Edit links; clay End-fast CTA; the italic coach line. Idle (not fasting) state should mirror the same chrome with a "Start fast" CTA.

## Preserve (wired — never drop)
Preset selection, start/end fast, the live elapsed/remaining timer + ring math, stage computation, started/goal editing, the coach narrative, idle vs active states.
