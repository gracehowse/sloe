/** Per-role grammar rules for the mobile Storybook catalog (ENG-1664). */
export const ROLE_DOCS = {
  Card: `**Card** — THE resting page-ground surface (SupprCard, size="card").

Use for: top-level content blocks on a screen — hero stats, meal slots, dashboard panels.
Do not use for: nested sub-panels (use InsetPanel), floating overlays (use Sheet), or inline chips.

Grammar: flat + hairline on the page ground (ENG-1497), radius 24, warm card fill. One card chrome everywhere — never hand-roll borderRadius on a resting card.`,

  InsetPanel: `**InsetPanel** — a sub-panel nested ON a card (SupprCard size="inset").

Use for: card-on-card detail blocks — burn breakdown, rolling averages, grouped rows inside a parent card.
Do not use for: page-ground cards (use Card) or full-screen overlays (use Sheet).

Grammar: radius 12 (concentric inside 24), hairline border, no ambient shadow.`,

  Notice: `**Notice** — inline informational or warning callout inside a form or sheet.

Use for: server validation nudges, implausible-macro warnings, image-quality hints.
Do not use for: toasts (transient), full-screen errors, or primary CTAs.

Grammar: bordered inset with semantic tint (warning/success/info). Acknowledgement rows are optional; never block the whole flow — flag-and-review instead.`,

  Sheet: `**Sheet** — a floated overlay surface for focused tasks.

Use for: log flows, pickers, confirmations, multi-step edits that need temporary focus.
Do not use for: resting page content (Card) or inline nudges (Notice).

Grammar: radius 24 (same material as cards), scrim behind, safe-area padding. Sheets keep elevation; page-ground cards stay flat.`,

  CommitPill: `**CommitPill** — the ONE solid primary CTA per screen (SupprButton variant="primary").

Use for: the single commit action on a screen — Save, Log meal, Continue.
Do not use for: secondary actions (GhostPill), filters (Chip), or icon-only controls (IconButton).

Grammar: solid aubergine fill, white label, full-radius pill, PressableScale press + confirm haptic. Exactly one filled CTA per screen (FAB + paywalls excepted).`,

  GhostPill: `**GhostPill** — secondary/tertiary text CTA (SupprButton variant="ghost").

Use for: Cancel, Skip, Learn more, low-emphasis actions beside the CommitPill.
Do not use for: the primary commit (CommitPill) or filter toggles (Chip).

Grammar: transparent fill, plum label, no border, same pill radius as CommitPill.`,

  Chip: `**Chip** — filter / option toggle (FilterChip).

Use for: meal-type filters, setting chips, segmented options that are NOT day cells.
Do not use for: day cells in week strips (solid primary fill — separate grammar) or trust badges (display-only chips).

Grammar: fully round, quiet rest fill, selected = primary-soft tint + primary-solid semibold label. No border at rest.`,

  AddRow: `**AddRow** — in-card "add another X" affordance (AddRowButton).

Use for: Add food, Add ingredient, Add step, Add slot — quiet actions inside a card.
Do not use for: upload dropzones (dashed border only) or primary commits (CommitPill).

Grammar: fillQuiet background, radius 12, Plus + primary-solid semibold label, full width in-card.`,

  IconButton: `**IconButton** — compact icon-only control (40px hit target).

Use for: toolbar actions, dismiss, overflow menus, settings rows with a single glyph.
Do not use for: labeled CTAs (CommitPill/GhostPill) or filter toggles (Chip).

Grammar: 40px circle, muted fill, no border/shadow, required accessibilityLabel, PressableScale + selection haptic. (Catalog fixture — shared primitive lands separately.)`,

  CountBadge: `**CountBadge** — numeric count pill on tabs and segments.

Use for: unread/review counts on SubTabPill, SegmentedTrack, plan source badges.
Do not use for: semantic status (TrustChip) or filter selection (Chip).

Grammar: min-width 20, height 18, full radius, caps at "999+", hidden at 0. Active tab inverts fill/text for contrast.`,
} as const;
