# Shopping list empty state — redesign spec

**Phase 6 P1 visual refit.**
**Authority:** `docs/specs/2026-04-27-production-design-spec.md` §1.5, §1.7, Part 3 EmptyState; `docs/decisions/2026-04-27-strategic-direction.md` D-2026-04-27-02 (Plan = planner + shopping sub-view).
**Audit source:** `docs/audits/2026-04-28-visual-qa-pixel-level.md` finding #5.

---

## 1. Universal `EmptyState` audit

**Verdict: Shopping is not using the universal primitive on either platform. Both surfaces hand-roll their empty state.** Both should migrate.

### Mobile — `apps/mobile/app/shopping.tsx:391-401`

Hand-rolls a `View` styled with `emptyCard` / `emptyIcon` / `emptyTitle` / `emptyDesc` / `ctaBtn` / `ctaBtnText` (lines 320-340). It does **not** import `EmptyState` from `apps/mobile/components/ui/EmptyState.tsx`. There is no slot constraint preventing migration — the universal primitive's contract (`icon`, `title`, `body`, `primaryCta`, `secondaryCta`) is a strict superset of what shopping renders today. The hand-roll exists only because shopping pre-dates the primitive (the primitive comment notes Phase 1 didn't sweep callers; this is the Phase 2 sweep for shopping).

**Action:** replace the hand-rolled `<View style={styles.emptyCard}>` block with `<EmptyState />` from `@/components/ui/EmptyState`.

### Web — `src/app/components/ShoppingList.tsx:96-104`

Renders a single muted card with `<p>No items</p>` — even thinner than mobile, no icon, no CTA, no body. Comment at lines 30-41 explicitly enumerates what was stripped vs earlier ports ("Empty state is a single muted 'No items' card"). This is a deliberate prototype-fidelity stripping, but the prototype's "No items" is a minimum-viable token for a state that prod-spec §Part 3 requires to be a full primitive. Adopt the universal `EmptyState` from `src/app/components/ui/empty-state.tsx`.

**Action:** replace the conditional `<div className="bg-card border border-border ..."><p>No items</p></div>` with `<EmptyState />` from `@/components/ui/empty-state`.

### Why no slot constraint blocks this

The mobile shopping screen wraps the empty state in a `ScrollView` with `contentContainerStyle.gap = Spacing.lg`. The universal primitive renders a flex column and pads itself — it slots straight in. The web grid container `grid-cols-1 md:grid-cols-3 gap-4` is short-circuited by the `totalItemCount === 0` branch above it, so the EmptyState sits cleanly outside the grid.

---

## 2. Illustration

**Replace the 🛒 emoji and the bare-card no-icon with a lucide `ShoppingBasket` glyph in an `<IconBox>` treatment.**

| Property | Value |
|---|---|
| Icon family | `lucide-react-native` (mobile) / `lucide-react` (web) per prod-spec §1.5 |
| Glyph | `ShoppingBasket` (round-shouldered shopping container — softer than `ShoppingCart`, more on-brand with the food-warm voice; not `ShoppingBag` which reads retail) |
| Stroke width | 1.75 (lucide default = 2; one notch lighter reads premium) |
| Glyph size | 24px / 24pt (`--icon-hero` token per §1.5) |
| Container | `<IconBox>` 48×48 rounded-12, bg `var(--primary)` at 10% opacity (`rgba(76,108,224,0.10)` light / `rgba(108,140,255,0.14)` dark), foreground `var(--primary)` |
| Margin-bottom to title | 12pt mobile / 12px web |

The IconBox is the same primitive used elsewhere in the prod spec (§Part 3 IconBox). It elevates the empty state from "ASCII apology" to "deliberate placeholder" without resorting to bespoke illustration. No supporting glyph (no sparkle — there's no AI in this surface; sparkle is reserved for AI-estimated provenance per §1.6).

### Why not a bespoke illustration

The prod spec §Part 3 EmptyState contract takes a single `icon` slot. Bespoke illustrations are reserved for the onboarding success Display tier (§1.2). Empty states across all 8 surfaces use lucide-in-IconBox by spec — Today error uses `WifiOff`, Library empty uses `BookOpen`, Plan empty uses `CalendarDays` (§Part 2 Surface D). Shopping empty uses `ShoppingBasket`. Consistent.

---

## 3. Copy

The user is most likely thinking one of three things when they hit this empty state:

1. "Where did my list go?" (their plan was wiped or never generated)
2. "I just signed up — how does this work?" (first-run after onboarding)
3. "I want to add things directly" (they expected a plain shopping list, not a plan-tied one)

We can't disambiguate without state, but we can orient: tell them where shopping lists come from in Suppr (the plan), and offer the most direct path forward. The current copy "No shopping list yet / Generate a meal plan first — your shopping list is created automatically" is decent but verbose and doesn't lead with the user's mental model.

### Final copy

| Slot | Copy |
|---|---|
| Title | **Your shopping list builds itself.** |
| Body | Generate a week's plan and we'll line up everything you need by aisle. |

UK English, sentence case, second-person, no exclamation marks (prod-spec §1.7 voice rules). Title leads with the promise, not the absence. The full stop after "itself" makes it land as a statement, not a tease.

**Rejected alternatives:**
- "No items yet" — current copy. Does no work; describes a vacuum.
- "Add items to your shopping list" — falsely implies the shopping list is a manual surface. Suppr's shopping list is plan-derived (mobile shopping.tsx already deletes items not tied to the live plan, lines 90-102). Telling the user to add items would be a lie.
- "Build your first plan to start shopping" — too imperative; reads like onboarding.

---

## 4. Primary CTA

**Recommendation: "Build this week" → routes to `/(tabs)/planner` (mobile) / Plan tab (web).**

This is the highest-value action: shopping lists in Suppr are plan-derived, so the only path to a real shopping list is to build a plan. Sending them to manual-add or browse-recipes would be a detour. "Build this week" matches the canonical Plan-empty CTA in prod-spec §Part 2 Surface D ("button 'Build this week'") — Shopping empty and Plan empty share the same destination because they share the same root cause.

### Button spec

| Property | Mobile | Web |
|---|---|---|
| Component | `<Button variant="default" size="default">` (primary, filled) — global primitive | `<Button variant="default" size="default">` from `src/app/components/ui/button.tsx` |
| Height | 44pt (touch target floor per §1.8) | 36px default (h-9) |
| Horizontal padding | 16pt (`Spacing.lg`) — symmetric, NOT `Spacing.xxxl` 32pt | 16px (`px-4`) |
| Corner radius | `Radius.md` 12pt | `rounded-md` (matches button system) |
| Font | `Type.body` 14/20 weight 700 mobile / `text-sm font-medium` web | |
| Glyph | `CalendarDays` lucide 16pt left of label, 6pt gap — signals "go to Plan" | `CalendarDays` 16px |
| Label | "Build this week" | "Build this week" |
| Background | `Accent.primary` (`#4c6ce0`) | `bg-primary` |
| Foreground | `colors.background` neutral white token, NOT `"#fff"` literal | `text-primary-foreground` |
| Haptic (mobile) | `success` on tap (prod-spec §1.1 — generation moments use success) | n/a |

This fixes the asymmetry called out in the audit: the current `paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxxl` (12 / 32) makes the button squat-and-wide in a way that doesn't match the global button system anywhere else.

---

## 5. Secondary action

**One ghost text-button: "Add an item manually" — only ship if manual-add codepath is wired.**

The "I want to add things directly" mental model is real. Even though the canonical shopping list is plan-derived, users have ad-hoc shopping needs (a single ingredient, a household item) that don't justify a whole plan. We don't ship "Add custom item" today on web (explicitly stripped per ShoppingList.tsx line 36); on mobile it doesn't exist either.

**Decision rule:** if executor confirms the manual-add codepath is wired, ship the secondary CTA active. If not, **either ship the codepath in the same change OR omit the secondary CTA entirely** — never ship a dead-ended button.

### Spec

| Property | Mobile | Web |
|---|---|---|
| Variant | `<Pressable>` ghost — text-only, no border, no background | `<Button variant="ghost">` |
| Label | "Add an item manually" | "Add an item manually" |
| Foreground | `colors.text` (not primary — we don't want it competing with the primary CTA) | `text-foreground` |
| Spacing from primary CTA | 8pt below mobile / `gap-3` web (`sm:flex-row` is the EmptyState default — keep stacked column on mobile, stacked column on narrow web, side-by-side on `sm+`) |
| Haptic (mobile) | `selection` on tap | n/a |

**No "Skip / browse later"** — this empty state is not a blocking surface.

---

## 6. Cross-platform parity

**Same shape on all three.** Mobile, mobile-web, desktop web all render the universal `EmptyState` with identical icon, copy, and CTA labels. Intentional deviations:

| Surface | Deviation | Why |
|---|---|---|
| Mobile native | Haptics on tap (success / selection) | Native motion vocabulary §1.1; web has no haptics |
| Mobile native | Routes via `expo-router` to `/(tabs)/planner` | Native nav |
| Web (any width) | Routes via existing `onNavigate("plan")` prop on `ShoppingListProps` | Web nav contract |
| Desktop web `sm+` (≥640px) | Primary + secondary buttons render side-by-side (`sm:flex-row` already in EmptyState primitive) | Horizontal rhythm reads natural at desktop widths; mobile keeps stacked column for thumb reach |
| Mobile web `<sm` | Stacked column, identical to native | Matches native muscle memory |

No copy divergence, no icon divergence, no CTA-label divergence.

---

## 7. Iconography sweep

| Line | Current | Replace with (lucide) | Token / size |
|---|---|---|---|
| 13 | `import { Ionicons } from "@expo/vector-icons";` | `import { Share2, Trash2, ShoppingBasket, CalendarDays } from "lucide-react-native";` | n/a — import |
| 376 | `<Ionicons name="share-outline" size={22} color={colors.text} />` | `<Share2 size={20} color={colors.text} strokeWidth={1.75} />` | `--icon-xl` 20pt per §1.5 |
| 379 | `<Ionicons name="trash-outline" size={22} color={Accent.destructive} />` | `<Trash2 size={20} color={Accent.destructive} strokeWidth={1.75} />` | `--icon-xl` 20pt |
| 393 | `<Text style={styles.emptyIcon}>🛒</Text>` (the emoji) | `<ShoppingBasket size={24} color={Accent.primary} strokeWidth={1.75} />` inside an `<IconBox>` | `--icon-hero` 24pt |
| (new) | (no calendar icon today) | `<CalendarDays size={16} color="#fff" strokeWidth={2} />` inside primary CTA | `--icon-base` 16pt |

Web `ShoppingList.tsx` has no Ionicons. Add `import { ShoppingBasket, CalendarDays } from "lucide-react";` for the EmptyState slot.

The back-button glyph at line 367 of mobile shopping is a literal `‹` Text character — out of scope for this brief; flag for a separate Navigation icons sweep ticket.

---

## 8. Acceptance criteria

1. **No emoji on the empty state.** Grep `apps/mobile/app/shopping.tsx` and `src/app/components/ShoppingList.tsx` for `🛒`, `🛍`, `🥕`, `🍎`, `🧺` — zero matches in JSX.
2. **No Ionicons import in shopping.tsx.** `grep "from \"@expo/vector-icons\"" apps/mobile/app/shopping.tsx` returns zero lines.
3. **Universal EmptyState used on both platforms.** Mobile imports `EmptyState` from `@/components/ui/EmptyState`; web imports from `@/components/ui/empty-state`.
4. **Title copy is exactly** `Your shopping list builds itself.` (full stop included). Body copy is exactly `Generate a week's plan and we'll line up everything you need by aisle.`
5. **Primary CTA label is exactly** `Build this week` (mobile + web).
6. **Primary CTA icon is `CalendarDays` 16pt lucide**, foreground neutral white, 6pt gap to label.
7. **Primary CTA uses the global Button primitive.** No bespoke `ctaBtn` styles.
8. **Hero icon is `ShoppingBasket` 24pt lucide** in an IconBox 48×48 rounded-12, primary-tinted bg at 10% opacity.
9. **Secondary CTA "Add an item manually"** appears only if executor wires (or confirms wired) the manual-add codepath. Otherwise omitted entirely.
10. **Tap on primary CTA routes to Plan/Planner.** Mobile: `router.push("/(tabs)/planner")`. Web: `onNavigate?.("plan")`.
11. **Mobile haptic on primary tap = `success`.**
12. **VoiceOver / screen-reader label on the IconBox is `null` (decorative, `aria-hidden`)** — title carries the announcement.
13. **Dark mode honoured.** No `"#fff"` literals introduced anywhere in the change.
14. **Visual-qa parity check.** Mobile native + mobile web + desktop web screenshot the empty state; copy, icon, CTA label match exactly across the three.
15. **No regression to the populated state.**

---

## 9. Open questions

1. **Manual-add codepath.** Is the `shopping_items` table's `source: "manual"` route wired end-to-end on mobile? If not, secondary CTA is omitted.
2. **Shopping-as-Plan-derivative orientation.** Strategic D-2026-04-27-02 collapsed Shopping into a Plan sub-view. Should the empty CTA copy reflect that? Default for this spec: assume the sub-tab pill bar already orients them; no extra chip.
3. **Dark mode IconBox primary tint.** `rgba(108,140,255,0.14)` is the §1.4 token; verify it has sufficient contrast against `#16161e` mobile bg / `#18181c` web bg before lock.
