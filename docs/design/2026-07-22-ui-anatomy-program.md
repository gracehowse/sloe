# The UI anatomy program — name every element, one owner per role

Commissioned by Grace 2026-07-22 (session pivot, verbatim): *"can we
refactor the app, so that every tweak can be implemented quickly and easily
across the whole app. ie, if i say change all cards to flat white cards with
rounded edges, they ALL change. This also might be where storybook comes in,
we havent properly mapped the whole app so we dont really have names and
functions for everything."*

## The two questions that define the problem

Grace's Plan-tab screenshot raised two "what's the rule here?" questions.
Both have exact answers — and the answers indict the system, not the screens:

**1 · White meals card vs the lavender notice above it.** The meals card is
`SupprCard` (white `card` fill, `Radius.card` = 24, flat + hairline — the
ENG-1497 ruling). The "Pick a few recipes" notice is `NorthStarBlockNonDefault`
styled inline with `colors.fillQuiet` (#F1F0F4) at `Radius.lg` = 8. The
**latent rule is real**: white card = *the user's content* (meals, data);
quiet lavender fill = *the system speaking* (nudges, hints, empty-state
prompts). But it's written down nowhere, has no named role, and the notice's
radius 8 contradicts ENG-1497's own text ("cards, banners, card-rows, tiles
and sheets all share" the 24 corner). A rule that exists only as folklore
gets violated by its own codebase.

**2 · Why is "Add food" squarer than everything else?** `AddRowButton` uses
`Radius.xl` = 12 + fillQuiet. It is actually FOLLOWING a documented rule —
the "12-inside-24 concentric standard" (nested/inset panels sit at 12 inside
the 24 card, per the `Radius.card` token comment). But the rule draws the
container/control boundary somewhere users can't see: the element *looks
like a button* sitting near `Radius.full` pills, so a correctly-implemented
inset panel **reads as an inconsistent button**. The anatomy lacks a named
boundary between "inset action row" and "pill control" — so even compliance
produces perceived drift.

One root cause: **treatments exist, several rules half-exist (ENG-1497,
12-in-24), but no named role system binds element → role → treatment, and
no catalog makes roles or violations visible.**

## What already exists (verified 2026-07-22)

- `apps/mobile/constants/theme.ts` — tokens are real and role-mapped:
  `Fonts` (serif/brand roles feeding the `Type` ramp — app-wide font swap is
  a one-file edit; 6 stray literal files), `Radius` {4,6,8,12,24,full},
  `Spacing`, `Colors` (incl. `fillQuiet`), `Elevation`. Web mirrors via
  `src/styles/theme.css` + Tailwind theme.
- Primitives: `SupprCard` (117 call sites), `SupprButton` (primary|ghost),
  `PressableScale`, `AddRowButton`, `FilterChip`, `SubTabPill`, `Toast`,
  `EmptyState`, ~20 total in `components/ui/`.
- Only-shrink ratchets already gate literals (token/spacing/type/radius/
  pressable) — the enforcement pattern for this program already exists.
- **Storybook: web has 2,392 stories + Chromatic + a11y addon in CI.
  Mobile has ZERO stories.** The unmapped half is mobile.

## The role taxonomy (proposal — Grace ratifies)

Every visible element gets exactly one role; every role has exactly one
owner component; every owner reads only tokens. Change the token or the
owner → the whole app changes. That is the entire mechanism.

### Surfaces (containers)

| Role | Owner | Treatment (today's ruling) | Rule |
|---|---|---|---|
| **PageGround** | screen scaffold | app neutral ground | the page itself; nothing else may set a screen background |
| **Card** | `SupprCard` | white fill, radius 24, hairline, flat | *the user's content* — meals, recipes, data, history |
| **InsetPanel** | `SupprCard inset` (new variant) | quiet fill, radius 12, borderless | panels/action-rows nested INSIDE a Card (the 12-in-24 standard, named at last) |
| **Notice** | `SupprNotice` (new, absorbs NorthStar blocks, offline banner, insight banners) | quiet fill, radius 24 per ENG-1497, leading icon slot | *the system speaking* — nudges, hints, empty prompts. Dismissible by contract |
| **Sheet/Overlay** | existing sheet primitives | float per ENG-1497 | modality keeps its shadow |
| **Dock** | tab bar | liquid-glass pill | one per app |

**ENG-1665 Plan-first slice (this wave):** `AdjustConstraintsSheet` → `SheetShell` +
`StepperCircleButton`; `PlanSourceSelector` count pills → `CountBadge` — all behind
`ui_anatomy_owners_v1` (legacy hand-rolled chrome in `AdjustConstraintsSheet.legacy.tsx`
when flag is off). `planner.tsx` chip-sheet grabbers already use `SheetGrabberBar`;
remaining Plan hand-rolled sheets (`PlanTemplatesSheet`, chip-sheet scrims) migrate onto
full `SheetShell` in follow-up PRs; shrink `check:anatomy` pins as each surface recomposes.

**Remaining sweep:** migrate remaining hand-rolled sheet grabbers
(~17 mobile surfaces after Plan slice) and icon-button literals to `SheetShell` /
`IconButton`. Screens → Today → web parity after Plan.

### Controls

| Role | Owner | Shape | Rule |
|---|---|---|---|
| **CommitPill** | `SupprButton primary` | radius-full, filled | the screen's one commitment (plus FAB) |
| **GhostPill** | `SupprButton ghost` | radius-full, hairline | secondary/tertiary CTAs |
| **Chip** | `FilterChip`/`SubTabPill` | radius-full, compact | filters, toggles, tags |
| **AddRow** | `AddRowButton` | **decide:** stays radius-12 as InsetPanel-with-action (then it must LOOK like a panel: full-width, left-aligned label) or becomes a GhostPill (then radius-full) — today it's neither, which is Grace's question 2 |
| **IconButton** | new tiny owner | radius-full | bell, calendar, kebab |

(Notices, rows, chips on WEB map 1:1 via the same role names in
`theme.css` classes/shadcn wrappers — parity by shared vocabulary.)

## Working-baseline rulings (2026-07-22, Claude as design lead — Grace may veto on ENG-1661)

Grace kicked off the programme before formal ratification; these two open
calls are ruled as a working baseline so the build isn't blocked:

1. **Notice radius = 24** (`Radius.card`). ENG-1497's text already says
   banners share the card corner; the census's 12s and 8s migrate to 24 as
   `SupprNotice` adoption proceeds.
2. **AddRow stays an InsetPanel-with-action (radius 12, quiet fill) and
   gains panel FORM**: full-width, left-aligned icon + label — the shape
   Julienne's own "Add Ingredient" rows use (Mobbin, 2026-07-22 pulls). A
   centred label in a radius-12 box reads as a squashed pill; a left-
   aligned row reads as a row. No radius change.

## The parity contract (Grace, 2026-07-22: "make sure you ensure web and mobile parity too")

Parity is enforced structurally, not aspirationally — the repo's own history
shows why (ENG-1007's promised web ratchet leg sat unbuilt for six weeks
until ENG-1592):

1. **One role vocabulary, two implementations.** Every role in the taxonomy
   has a named owner on BOTH platforms; the web census (workflow
   `ui-anatomy-census-web`, same schema + explicit mobileParityNotes) maps
   web's current treatments and divergences from the shared rulings.

   | Role | Mobile owner | Web owner |
   |---|---|---|
   | Card / InsetPanel | `SupprCard` | shadcn `Card` wrapper reading `--radius-card-lg`/hairline tokens |
   | Notice | `SupprNotice` | `SupprNotice` (web) — same props, `--fill-quiet` ground |
   | Sheet | `SheetShell` | existing Dialog/Drawer normalised to one scrim + radius |
   | CommitPill / GhostPill | `SupprButton` | `SupprButton` web (exists per the 2026-06-12 ruling) |
   | IconButton / CountBadge | new mobile owners | shadcn `Button size=icon` wrapper / `Badge` variant |

2. **Same-ticket web legs.** ENG-1662 (owners), ENG-1663 (ratchet), and
   ENG-1665 (sweeps) each carry their web scope INSIDE the ticket — a
   mobile-only close is a scope violation, not a partial win. ENG-1664 is
   itself the parity move (mobile joins web's Storybook/Chromatic).
3. **The tweak-latency test runs on both platforms**: "all cards flat white
   rounded" must be ≤3 lines on mobile (`theme.ts` + SupprCard) AND ≤3
   lines on web (`theme.css` + the Card wrapper) — one sentence from Grace,
   two tiny diffs, every screen on both platforms.

## The refactor mechanics (no big-bang)

1. **Ratify the taxonomy** (this doc) — including the AddRow call and the
   Notice radius (8→24 per ENG-1497, or amend the ruling).
2. **Census-pin-shrink** — the repo's proven pattern: the anatomy census
   (workflow `ui-anatomy-census`, results appended below) pins every
   off-role treatment in a budget JSON; a new `check:anatomy` ratchet
   fails CI on NEW inline container/control styling outside owner
   components; migrations shrink the pin.
3. **Owner components first** — add `SupprCard variant="inset"`,
   `SupprNotice`, `IconButton`; collapse the census's near-duplicates into
   them. Screens then recompose mechanically, surface by surface, behind
   the standard flag gate.
4. **Storybook for mobile** — React Native Storybook (on-device +
   `@storybook/react-native-web-vite` for CI/Chromatic reuse). One story
   per ROLE (not per screen), stating the rule in the story description —
   the catalog IS the documentation. Web's existing 2,392-story setup
   already carries the Chromatic pipeline; mobile roles join it via the
   RN-web builder so both platforms' primitives sit in one catalog.
5. **Tweak-latency test** (the acceptance bar, from Grace's framing): "all
   cards flat white rounded" / "all headers serif X" / "ground to warm
   paper" must each be a ≤3-line diff hitting every screen. If a tweak
   needs per-screen edits, a role is missing an owner — extend, don't
   patch.

## Census results (workflow `ui-anatomy-census`, 5 agents, 2026-07-22)

Full structured results: workflow journal `wf_55be8a3a-512` (per-area JSON
with file:line evidence for every claim below).

**Headline: the app renders ~131 distinct treatments across the three role
families that the taxonomy needs ~15 roles to cover.**

- **43 container treatments** (36 of them inline/raw, not via a primitive)
- **57 control shapes** · **31 notice treatments**
- **52 named same-role-different-treatment inconsistencies**
- Radius histogram: the tokens dominate (full 228 · 6 ≈174 · 24 ≈88+52+51 ·
  12 ≈52+47 · 8 ≈50+34 · 4 ≈35), but ~30 distinct **literal** values ride
  along — 2/3/5/7/9/10/11/13/14/16/18/20/22/28/32/36/40/48/50 — mostly
  progress bars, grabbers, dots, and hand-sized circles with no token.

The worst offenders (each with file:line evidence in the journal):

1. **Bottom sheets — one role, three top radii** (24 `SHEET_RADIUS` vs
   others), **three scrim recipes** (`MODAL_OVERLAY_SCRIM` token vs two
   literal rgba blacks), and the identical 36×4 **grabber built three ways**.
2. **SupprCard adoption is thin exactly where it matters**: in Plan, 1 of
   ~7 page-ground cards uses it — the rest import `CARD_RADIUS` and rebuild
   the card inline. (The "117 call sites" adoption stat hides this.)
3. **Three confidence/provenance chips, three treatments**: `TrustChip`
   (Soft tokens) vs `ConfidenceChip` (verbatim-copied chrome) vs
   `SearchResultConfidenceChip` (raw rgba fills + literal hex, heavier
   type) — one role, three implementations, one of which a comment forbids
   merging.
4. **Notices span three radii** (24 vs 12 vs 8) — Grace's question 1 is
   this line item.
5. **Add affordances diverge three ways**: dashed-border row vs radius-24
   filled row vs outline pill (plus `AddRowButton` at 12) — Grace's
   question 2 is this line item.
6. **Skeletons don't match what they load into** (radius 6/8 + hairline vs
   the radius-24 flat card) — corners visibly jump on every load.
7. **Toast breaks the card grammar** (radius 6, 1px border, bespoke inline
   shadow bypassing the Elevation recipes).
8. **A count badge duplicated verbatim** across `SubTabPill`/`SegmentedTrack`
   with a comment admitting the copy; **a radio control built twice** with
   different tokens; **steppers in three sizes/fills**; **secondary-CTA
   grammar forked** by three hand-rolled outline pills the 2026-06-12
   button ruling says shouldn't exist.

None of this is a redesign backlog — it's the *same* design shipped many
ways. Consolidation is mechanical once roles are ratified.
