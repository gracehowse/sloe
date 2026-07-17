---
date: 2026-07-17
area: design-system
status: Ratified
owner: Grace
linear: ENG-1574
---

# Primary UI consistency contract

## Decision

Sloe's authenticated product keeps the production **cool plum-white canvas**
(`#F7F6FA`) with white, flat, hairline-separated cards. Warmth belongs in food
photography, its editorial grade, and deliberately bounded food surfaces — not
in a beige application shell or beige empty-state cards.

Composition consistency is the next design-system priority. Plan, Recipes,
Progress, Settings, and comparable utility screens converge on the existing
shared screen-chrome primitives:

- quiet tracked-caps overline;
- 33px Newsreader page title;
- right-slot actions rendered as 40px muted circles with an ink Lucide glyph;
- no bordered, square, or shadowed header-action variant.

**Today is the explicit exception.** Its wordmark and ring-first composition are
intentional product hierarchy. This decision does not add a redundant 33px
"Today" title or force Today into the standard page-title template.

The implementation extends `ScreenSectionChrome` / `ScreenChrome`. A third
parallel page-chrome primitive is not permitted.

## Supporting product rules

### Navigation owns its surface

- Root tabs may show the floating tab bar; pushed utility screens and sheets own
  the viewport and must not show it.
- Settings is a pushed stack surface, not a hidden tab pretending to be both a
  destination and a child screen.
- Every floating bar reserves its full measured height plus breathing room in
  scroll content. The final row or control must remain fully reachable.
- Desktop navigation highlights the current destination. Settings must not
  leave Today selected.

### Empty and sparse states remove chrome

- A genuinely empty surface presents one useful invitation and one primary
  action. It does not preserve zero-valued dashboards or walls of empty slots.
- Desktop Plan's remaining gap is the `StatStrip` plus dashed week body:
  ENG-1547 already suppresses the empty verdict. The replacement invitation is
  `PlanEmptyWeekCard`; partial and populated plans keep their normal structure.
- Sparse collections must not repeat the same recipe as both hero and shelf
  content. Composition is defined for 0, 1, 2, and many items.
- Progress leads with data the person already has. When weight history is
  absent, weight setup is secondary to any available nutrition or activity
  progress.

### Recipe media has one fallback policy

Discover and Library prefer valid food photography when present. Missing or
failed media resolves to one deterministic plum-duotone treatment on web and
mobile. Beige utensil textures and ad-hoc coloured blocks are retired as
competing fallbacks.

This is a **fallback-policy** issue, not a claim that native refuses images or
that web always has them. The observed split also depends on card type, URL
availability, loading, and error state.

### Text colour follows semantic role

Sibling `stat` and `stat-sm` values remain ink. Sage, amber, plum, and macro
colours communicate state only through the sanctioned pill, dot, bar, arc,
chart, or macro-token roles. A green statistic beside a plum statistic is not a
substitute for state communication.

### Log is search-first and has one entry per method

The Log sheet keeps Photo, Voice, Describe, Quick add, barcode, relevant day
utilities, and browse tabs, but each method receives exactly one entry point.
When a search query is active, search results own the sheet and secondary method
chrome recedes. The post-ENG-1532 work is a method-hierarchy correction, not a
reintroduction of removed barcode duplicates.

### Controls are censused before they are replaced

ENG-1375 and ENG-1532 recently consolidated segmented controls, chips, and Log
controls. Implementation first inventories remaining local variants against
those shared primitives. Confirmed drift is migrated; already-converged controls
are left alone.

## Evidence and corrections

The 2026-07-17 authenticated review covered Today, Plan, Library, Progress,
Discover, Settings, and the Log sheet on desktop web and iPhone 17 Pro. Today and
Log were also inspected in dark mode. It confirmed:

- Plan still uses 28px type with 38px shadowed square actions while Recipes and
  Progress use 24px shared chrome;
- the floating iOS bar obscures reachable content in Library, Progress, and
  Settings;
- Settings combines back navigation with root-tab chrome, while web Settings
  highlights Today;
- desktop Plan omits the invitation card and retains its zero-stat/dashed-slot
  body;
- a one-recipe Library can repeat the same recipe across editorial positions;
- sibling stats use decorative colour instead of role semantics; and
- the Log sheet still gives too many methods equal visual priority.

This record incorporates the adversarial follow-up review:

- the ground conflict is in Constitution Rules 0/6 and its violation census,
  not the previously cited status prose;
- ENG-1547 delivered the empty-verdict gate, not the remaining Plan body fix;
- recipe imagery is reframed as one sanctioned no-image policy;
- Today is carved out of the 33px title requirement;
- the chrome migration covers the existing 24px and Plan 28px variants, not
  Plan alone; and
- Log hierarchy is medium-priority until its method inventory is pinned.

Earlier evidence: [2026-07-05 UI critique and Mobbin benchmark](../ux/reviews/2026-07-05-ui-critique-mobbin-benchmark.md).
Related governing decisions: [card grammar](2026-07-10-card-grammar-rounder-flat.md)
and [Progress hierarchy](2026-07-16-progress-hierarchy-v1.md).

## Source-of-truth amendment

This decision supersedes only the Design Constitution's conflicting product-
shell statements: Rule 0's "warm ground", Rule 6's `#fbfaf6` application ground,
the warm-oat violation-census target, and the stale "warm canvas sidebar"
delivery claim. It ratifies the shell/chrome subset described here without
ratifying unrelated prototype claims.

Production `theme.css`, ENG-1316, and ENG-1496 remain authoritative on the cool
canvas. The Constitution continues to govern warm photographic grading and the
plum-duotone fallback.

## Alternatives rejected

- **Restore the warm-oat shell.** This reverses the later production ruling,
  current tokens, and the explicit retirement of beige empty-state grammar.
- **Fix screens independently.** Local patches recreate the same drift because
  they leave more than one composition contract alive.
- **Create a new universal header.** Recipes and Progress already share the
  right starting primitive; extending it is cheaper and safer than a third API.
- **Replace every control again.** Recent deduplication work should be verified,
  not discarded on the strength of an older screenshot.

## Confidence and limits

Confidence is **9/10** for authenticated primary surfaces in light mode. Dark-
mode conclusions are provisional beyond Today and Log; every implementation
slice must capture all affected screens in light and dark before rollout.
