/** Canonical copy for the Today / tracker / calorie-balance surfaces across
 *  web, mobile, and the marketing landing page.
 *
 *  Purpose: **one source** for the words we use around the daily calorie
 *  ring and net balance. If you change a string here, the parity test in
 *  `tests/unit/todayCopyParity.test.ts` will catch surfaces that drift.
 *
 *  Not for UI composition — just the strings. UI components own layout.
 *
 *  Used by:
 *    - Web:    `NutritionTracker`, `BurnDetailPanel`
 *    - Mobile: `TodayDeficitInsight` (the forward "Room for {meal}"
 *      under-ring coach line — `todayRoomForMeal` / `nextUnloggedMealSlot`),
 *      `TodayActivityBonusCard`
 *    - Landing `app/(landing)/LandingPage.tsx`
 */

import { dateKeyFromDate } from "../nutrition/journalNavigation";
import { coachSlotAimKcal, unloggedMealSlotCount } from "../nutrition/mealBudget";

/** Overline labels above the big number inside the daily calorie ring.
 *  The ring has three states:
 *    - `consumed` display mode   → label is `LOGGED`, number is kcal logged
 *    - `remaining`, under target → label is `REMAINING`, number is kcal left
 *    - `remaining`, over target  → label is `OVER`, number is kcal over target
 *  Rendered uppercase by the ring components on both platforms. */
export const RING_LABELS = {
  logged: "LOGGED",
  // 2026-06-10 (Grace's ring-content spec): the centre reads "LEFT" —
  // "REMAINING" arced too long under the number. LOGGED retired with the
  // Remaining/Consumed toggle (the EATEN stat below the ring carries it).
  remaining: "LEFT",
  over: "OVER",
} as const;

/** Back-compat alias — prefer `RING_LABELS.remaining`. */
export const TODAY_RING_OVERLINE = RING_LABELS.remaining;

/** Locale for Today hero date lines (British English). */
export const TODAY_DATE_LOCALE = "en-GB" as const;

/** Long date subline under the Today hero greeting (`01 · Today` frame).
 *  e.g. "Wednesday, 4 June" in en-GB. Shared web ↔ mobile. */
export function todayLongDateSubline(
  d: Date,
  locale: string = TODAY_DATE_LOCALE,
): string {
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Day NAME alone for the v3 serif date hero (`.tg-day`), e.g. "Wednesday".
 *  The v3 prototype splits the old combined "Wednesday, 4 June" subline into a
 *  big serif day name + a small date subline ({@link todayShortDate}). Shared
 *  web ↔ mobile so the two surfaces format identically. */
export function todayDayName(
  d: Date,
  locale: string = TODAY_DATE_LOCALE,
): string {
  return d.toLocaleDateString(locale, { weekday: "long" });
}

/** Short date for the v3 serif hero subline (`.tg-sub`), e.g. "18 June" — the
 *  date without the weekday (the serif {@link todayDayName} carries that).
 *  Shared web ↔ mobile. */
export function todayShortDate(
  d: Date,
  locale: string = TODAY_DATE_LOCALE,
): string {
  return d.toLocaleDateString(locale, { day: "numeric", month: "long" });
}

/** Headline + optional subline for a historic journal day (not today).
 *  Date-forward — no time-of-day greeting on past days. */
export function todayPastDayGreetingLines(
  d: Date,
  now: Date = new Date(),
): { headline: string; subline: string | null } {
  const dk = dateKeyFromDate(d);
  const todayStr = dateKeyFromDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = dateKeyFromDate(yesterday);
  if (dk === yesterdayStr) {
    return { headline: "Yesterday", subline: todayLongDateSubline(d) };
  }
  return { headline: todayLongDateSubline(d), subline: null };
}

/** Status chip above the calorie ring on the Sloe Today hero (`01 · Today`).
 *  Aligns with Figma mock labels (Grace 2026-06-04): Under/Over budget on
 *  the chip only — other Today surfaces still avoid those bigrams via
 *  {@link FORBIDDEN_TODAY_PHRASES}. Same words web ↔ mobile. */
export function todayStatusChip(
  state: "empty" | "under" | "over",
  _overByKcal?: number,
): string {
  if (state === "empty") return "Fresh start";
  if (state === "over") return "Over budget";
  return "Under budget";
}

/** Suffix rendered below the ring number, e.g. "of 1,800 kcal". Never
 *  show the number without the `kcal` unit — the prototype used to drop
 *  the unit in some mocks and that led to ambiguity ("380 of 1,800" —
 *  of what?). */
export function todayRingSuffix(targetKcal: number): string {
  return `of ${targetKcal.toLocaleString()} kcal`;
}

/** Headline for the Today "Weekly insight" card (Sloe `TD3` re-skin,
 *  2026-06-03 — `docs/prototypes/stitch-sloe/today-insight.html`). The
 *  Sloe mock's "You're trending right where you want to be" is a
 *  *fabricated* coaching claim; this helper instead derives a calm,
 *  HONEST headline from the real logged/on-target counts so we never
 *  assert a trend the data doesn't support:
 *    - no logged days            → "Your week starts here"
 *    - most logged days on target → "Trending right where you want to be"
 *      (the encouraging line, earned only when ≥60% of logged days landed
 *      within the calorie band AND at least 2 days are logged)
 *    - otherwise                  → "Your week so far"
 *  Shared so web + mobile read identically. Calm-tone: no
 *  FORBIDDEN_TODAY_PHRASES, no diet-culture shaming. */
export function weeklyInsightHeadline(
  loggedDays: number,
  onTargetDays: number,
): string {
  if (loggedDays <= 0) return "Your week starts here";
  if (loggedDays >= 2 && onTargetDays >= Math.ceil(loggedDays * 0.6)) {
    return "Trending right where you want to be";
  }
  return "Your week so far";
}

/** Optional coach line under the Weekly-insight stats (Sloe `TD3`). Returns
 *  `null` when there's nothing honest + useful to say (e.g. no logged days
 *  yet, or a single logged day — too little signal). Never fabricates a
 *  protein/streak claim the card isn't fed data for; the line is purely a
 *  factual restatement of the on-target count.
 *    - ≥2 logged, ≥60% on target → "{n} of {m} days landed on target — nice."
 *    - ≥2 logged, some on target  → "{n} of {m} days on target so far."
 *    - else                       → null (card omits the line). */
export function weeklyInsightCoachLine(
  loggedDays: number,
  onTargetDays: number,
): string | null {
  if (loggedDays < 2) return null;
  if (onTargetDays <= 0) return null;
  if (onTargetDays >= Math.ceil(loggedDays * 0.6)) {
    return `${onTargetDays} of ${loggedDays} days landed on target — nice.`;
  }
  return `${onTargetDays} of ${loggedDays} days on target so far.`;
}

/** Figma `654:2` hero stat row under the ring (Goal / Eaten / Bonus). */
export const TODAY_HERO_STAT_LABELS = {
  goal: "Goal",
  eaten: "Eaten",
  bonus: "Bonus",
  over: "Over",
} as const;

/** Legacy four-tile row (Logged / Target / Burned / Net) — landing +
 *  detail panels only; Today hero uses {@link TODAY_HERO_STAT_LABELS}. */
export const TODAY_STAT_LABELS = {
  logged: "Logged",
  target: "Target",
  burned: "Burned",
  net: "Net",
} as const;

/** Opt-in affordance for the inner protein/carbs/fat breakdown on the
 *  calorie hero. Macros stay hidden by default; the macro tile grid below
 *  the hero is the primary surface. Label stays treatment-agnostic
 *  ("macros", not "rings"/"bars"): the toggle reveals the hero's inner
 *  sub-rings, while the below-hero surface renders as bars/tiles, so
 *  neither shape word is universally true. */
export const MACRO_RING_TOGGLE = {
  show: "Show macros",
  hide: "Hide macros",
} as const;

/** Detail line for the `Net` stat — describes which side of maintenance
 *  the user is on in plain deficit/surplus terms. "Deficit" is the
 *  canonical word across product (matches mobile `Net deficit / Net
 *  surplus` and web `Budget & deficit`). Historical variants "below
 *  maint.", "below TDEE", and "under budget" are retired. */
export const NET_DEFICIT_LABEL = "deficit";
export const NET_SURPLUS_LABEL = "surplus";
export const NET_MAINTENANCE_LABEL = "maintenance";

/** Resolve the net detail from kcal delta (net = logged − target).
 *  - Negative delta  → deficit (user ate less than target)
 *  - Positive delta  → surplus
 *  - Exactly zero    → maintenance  */
export function netDetailFromKcal(netKcal: number): string {
  if (netKcal < 0) return NET_DEFICIT_LABEL;
  if (netKcal > 0) return NET_SURPLUS_LABEL;
  return NET_MAINTENANCE_LABEL;
}

/** Section header convention for today's meals. We use **per-slot
 *  headers** (Breakfast / Lunch / Dinner / Snack) across web, mobile,
 *  and landing — never a single generic "Today's meals" title. Slot
 *  headers keep landing screenshots visually identical to the real
 *  product and help the user parse meals by slot at a glance. */
export const MEAL_SLOT_HEADERS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
} as const;

/** Prose headline for the "today's calorie balance" banner.
 *
 *  RETIRED from the live Today surface 2026-06-04 (Sloe `01 · Today`):
 *  the under-ring line is now the forward-looking {@link todayRoomForMeal}
 *  coach line, not this backward "deficit so far today" restatement. The
 *  backward energy-balance trend still lives in the Energy balance section
 *  (`TodayActivityBonusCard`) below the ring, so this prose headline is no
 *  longer rendered anywhere — kept only for the copy-parity test's
 *  deficit/surplus phrasing coverage. Web never rendered an equivalent
 *  (2026-04-18 Pass 7 cleanup). */
export function todayBalanceHeadline(balanceKcal: number): string {
  if (balanceKcal > 0) {
    return `About ${balanceKcal.toLocaleString()} kcal ${NET_DEFICIT_LABEL} so far today`;
  }
  if (balanceKcal < 0) {
    return `About ${Math.abs(balanceKcal).toLocaleString()} kcal ${NET_SURPLUS_LABEL} so far today`;
  }
  return "On your calorie target so far today";
}

/** Ordered meal slots, in the order the day is eaten. Mirrors
 *  `ALL_MEAL_SLOTS` in `src/lib/nutrition/mealPlanAlgo.ts` — the "next
 *  unlogged meal" walk for the Today coach line steps through these in
 *  order (Breakfast → Lunch → Dinner → Snacks). Kept as its own const
 *  in the copy module so the copy helpers below have no dependency on the
 *  nutrition engine. */
export const TODAY_MEAL_SLOT_ORDER = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snacks",
] as const;

export type TodayMealSlot = (typeof TODAY_MEAL_SLOT_ORDER)[number];

/** Lower-cased slot word for the in-sentence "Room for {meal}" coach
 *  line — "Room for dinner", not "Room for Dinner". Snacks reads as the
 *  singular "a snack" so the sentence stays natural ("Room for a
 *  snack — about 180 kcal to play with."). */
const SLOT_SENTENCE_WORD: Record<TodayMealSlot, string> = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  Dinner: "dinner",
  Snacks: "a snack",
};

/** Minimum remaining calorie budget (kcal) before the Today coach line
 *  will claim there's "room" for another meal. Below this the day is
 *  effectively spent — claiming room would read as pressure, not
 *  permission (the line's whole point is permission, not restriction),
 *  and ~50 kcal is below the precision a meal can be logged at anyway.
 *  Mirrors the ≥50 kcal noise floor the retired deficit sub-line used. */
export const TODAY_ROOM_MIN_KCAL = 50;

/** Forward-looking, warm coach line shown under the Today calorie ring
 *  (Sloe `01 · Today` frame). Replaces the retired backward "deficit so
 *  far today" line with the question the product answers best — "what's
 *  there room for next?" — framed as permission, never restriction.
 *
 *  Inputs:
 *    - `remainingKcal` — calorie budget left today (goal − consumed).
 *    - `nextMeal` — the first unlogged slot today (Breakfast → Lunch →
 *      Dinner → Snacks), or `null` when every slot already has a meal.
 *
 *  HONESTY rules (returns `null` → the surface renders nothing):
 *    - `remainingKcal` below {@link TODAY_ROOM_MIN_KCAL} (≈ at / over
 *      budget) → `null`. We never claim room the user doesn't have.
 *    - All meals logged but budget remains (`nextMeal == null`) →
 *      "About {remaining} kcal left for today. No rush." (no slot to
 *      name, but the headroom is real and worth stating calmly).
 *    - When several slots remain and the full remaining budget would
 *      misread as a single-meal target (e.g. 901 kcal "for breakfast")
 *      → "Plan your day — about {remaining} kcal left. No rush." when
 *      ≥3 slots are unlogged, else "Aim for about {slotAim} kcal at
 *      {meal}. No rush." when remaining materially exceeds the slot
 *      share (see {@link coachSlotAimKcal}).
 *    - Otherwise (last meal / remaining ≈ slot share) → "Room for
 *      {meal} — about {remaining} kcal to play with. No rush."
 *
 *  Calm-tone: contains no FORBIDDEN_TODAY_PHRASES; "No rush." is the
 *  permission close (matches the Sloe warm-coaching direction). Shared so
 *  web reads identically if/when it reaches Today parity. */
/** When remaining exceeds the slot share by more than this factor, we
 *  quote the slot aim instead of the full-day remainder. */
const COACH_AIM_REMAINING_RATIO = 1.15;

/** Unlogged slots at or above this → "Plan your day" (early-day headroom). */
const COACH_PLAN_DAY_MIN_UNLOGGED_SLOTS = 3;

function mealPhraseForAim(slot: TodayMealSlot): string {
  return slot === "Snacks" ? "for a snack" : `at ${SLOT_SENTENCE_WORD[slot]}`;
}

/** ENG-939 — warm food-forward invitation when the day is completely
 *  unlogged. Time-aware meal wording; omits kcal so cold-open reads as
 *  welcome, not scoreboard.
 *
 *  ENG-1549 — the "Fresh start — " prefix was dropped: the hero's status
 *  chip already says "Fresh start" right above this coach line, so the
 *  prefix rendered the phrase twice in the same card. The chip carries the
 *  state; this line carries the actionable invitation. */
export function todayColdOpenCoachLine(hour: number): string {
  if (hour < 11) return "What's for breakfast?";
  if (hour < 15) return "What's for lunch?";
  if (hour < 20) return "What's for dinner?";
  return "Log when you're ready.";
}

/** ENG-1372 (empty-state grammar contract, law 2) — the fresh-day hero's
 *  ONE filled, time-aware invitation pill. Distinct 2-boundary ladder from
 *  `slotForHour` (11 / 15 / 17 → Breakfast/Lunch/Snacks/Dinner) per the
 *  Fable design contract's explicit spec: before 11 / 11–16 / after 16
 *  collapses to just the three named meals a fresh-day pill should ever
 *  offer (a "Log snacks" pill would read oddly as the ONLY hero action).
 *  Slot + label always agree — {@link todayFreshDayLogPillSlot} returns the
 *  slot this label names, so the pill's tap target and its copy can never
 *  drift apart. */
export function todayFreshDayLogPillLabel(hour: number): string {
  if (hour < 11) return "Log breakfast";
  if (hour < 16) return "Log lunch";
  return "Log dinner";
}

/** The journal slot the fresh-day pill's tap opens the LogSheet scoped to.
 *  Same 11 / 16 boundary as {@link todayFreshDayLogPillLabel} — kept as a
 *  separate export (not a derived parse of the label) so callers get a
 *  typed `TodayMealSlot` directly. */
export function todayFreshDayLogPillSlot(hour: number): TodayMealSlot {
  if (hour < 11) return "Breakfast";
  if (hour < 16) return "Lunch";
  return "Dinner";
}

export function todayRoomForMeal(
  remainingKcal: number,
  nextMeal: TodayMealSlot | null,
  loggedSlots?: Iterable<string>,
  hour?: number,
): string | null {
  const remaining = Math.round(remainingKcal);
  if (remaining < TODAY_ROOM_MIN_KCAL) return null;
  const kcal = remaining.toLocaleString();
  if (nextMeal == null) {
    return `About ${kcal} kcal left for today. No rush.`;
  }

  if (loggedSlots) {
    const unlogged = unloggedMealSlotCount(loggedSlots);
    if (unlogged >= COACH_PLAN_DAY_MIN_UNLOGGED_SLOTS) {
      if (unlogged >= 4 && hour != null) {
        return todayColdOpenCoachLine(hour);
      }
      return `Plan your day — about ${kcal} kcal left. No rush.`;
    }
    const slotAim = coachSlotAimKcal(remaining, nextMeal, loggedSlots);
    if (remaining > slotAim * COACH_AIM_REMAINING_RATIO) {
      return `Aim for about ${slotAim.toLocaleString()} kcal ${mealPhraseForAim(nextMeal)}. No rush.`;
    }
  }

  return `Room for ${SLOT_SENTENCE_WORD[nextMeal]} — about ${kcal} kcal to play with. No rush.`;
}

/** Resolve the first unlogged meal slot for the Today coach line.
 *  Walks {@link TODAY_MEAL_SLOT_ORDER} and returns the first slot that
 *  has no logged meal today; returns `null` when every slot has at least
 *  one meal (the all-logged fallback in {@link todayRoomForMeal}).
 *
 *  `loggedSlots` is the set of slot names already logged today (raw
 *  `JournalMeal.name` values, already slot-normalised by the caller via
 *  `normalizeJournalSlotName`). Matching is case-insensitive on the slot
 *  word so a stray casing variant ("dinner") still counts as logged. */
/** Figma `654:2` summary row title — one logged entry shows the food name;
 *  multi-item slots show an aggregate count (ENG-1058). */
export function figmaSlotSummaryTitle(
  meals: ReadonlyArray<{ recipeTitle: string }>,
): string {
  if (meals.length <= 1) {
    return meals[0]?.recipeTitle?.trim() ?? "";
  }
  return `${meals.length} items`;
}

export function nextUnloggedMealSlot(
  loggedSlots: Iterable<string>,
): TodayMealSlot | null {
  const logged = new Set<string>();
  for (const s of loggedSlots) {
    const t = s.trim().toLowerCase();
    if (t) logged.add(t);
  }
  for (const slot of TODAY_MEAL_SLOT_ORDER) {
    if (!logged.has(slot.toLowerCase())) return slot;
  }
  return null;
}

/** Phrases that must never ship on any Today surface. Used by
 *  `tests/unit/todayCopyParity.test.ts` as a grep list. The match
 *  is case-INSENSITIVE — "Over budget" and "over budget" are both
 *  rejected; the test normalises both source and pattern to lower-
 *  case before scanning. If a real user-facing need brings one of
 *  these back, update *both* the test allowlist and this constant
 *  so the drift is a deliberate decision.
 *
 *  Calm-tone audit (round 4, 2026-04-30): "Over budget" / "Under
 *  budget" were retired on general Today surfaces; replaced with
 *  "Net deficit" / "Net surplus" on balance copy. The hero status chip
 *  re-adopted "Under budget" / "Over budget" per Figma + Grace
 *  2026-06-04 — see `docs/decisions/2026-06-04-today-status-chip-budget-labels.md`.
 *  Those bigrams stay forbidden everywhere else. */
/** Settings path for Apple Health / connections (post–IA-collapse 2026-04-28). */
export const TODAY_HEALTH_CONNECT_ROUTE = "Settings → Connections";

/** Steps & activity empty-state (ENG-873). */
export function todayHealthConnectActiveCaloriesHint(): string {
  return `Active calories appear here once a source is connected (${TODAY_HEALTH_CONNECT_ROUTE}).`;
}

/** Energy balance empty-state when Apple Health is NOT connected (ENG-873). */
export function todayHealthConnectEnergyEmptyHint(): string {
  return `No resting or active energy for this day in Sloe yet. Open ${TODAY_HEALTH_CONNECT_ROUTE}, enable Apple Health, then pull to refresh or revisit this tab to sync.`;
}

/** Energy balance empty-state when Apple Health IS connected but no burn
 *  data has synced for this day yet (ENG-1534). The prior copy reused the
 *  not-connected hint above and told already-connected users to "enable
 *  Apple Health" — a state conflation. Connected-with-no-data-yet gets a calm,
 *  accurate line with no "enable" nag: the source is connected; the numbers
 *  land on the next sync or once the user moves. The empty state only renders
 *  for `isToday`, so "once you move" is always valid. */
export function todayHealthConnectedNoDataHint(): string {
  return "No activity data for this day yet — it'll appear after your next sync, or once you move.";
}

/** 7-day rolling card — avg vs weekly totals use different denominators (F-06). */
export const WEEKLY_ROLLING_DENOMINATOR_HINT =
  "Weekly total is all 7 days in this window; daily average is logged days only.";

export const FORBIDDEN_TODAY_PHRASES = [
  "below maint",
  "below maintenance",
  "below TDEE",
  "under budget",
  "over budget",
  "you went over",
  "don't break your streak",
  "streak lost",
  "broke your streak",
  "More → Connected",
  // "Today's meals" was banned 2026-04-30 (per-slot headers only). The Sloe
  // redesign (Figma `01 · Today` / `today-meallog`, 2026-06-04) reintroduces it
  // as the SECTION header ABOVE the per-slot groups — which still render — so
  // the parse-by-slot intent is preserved and the title is no longer forbidden.
] as const;
