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

/** Overline labels above the big number inside the daily calorie ring.
 *  The ring has three states:
 *    - `consumed` display mode   → label is `LOGGED`, number is kcal logged
 *    - `remaining`, under target → label is `REMAINING`, number is kcal left
 *    - `remaining`, over target  → label is `OVER`, number is kcal over target
 *  Rendered uppercase by the ring components on both platforms. */
export const RING_LABELS = {
  logged: "LOGGED",
  remaining: "REMAINING",
  over: "OVER",
} as const;

/** Back-compat alias — prefer `RING_LABELS.remaining`. */
export const TODAY_RING_OVERLINE = RING_LABELS.remaining;

/** Sloe Today hero greeting (redesign, 2026-06-03 — `01 · Today` frame).
 *  Renders "Morning, {name}" / "Afternoon, {name}" / "Evening, {name}"
 *  in Newsreader at the top of Today. `hour` is the local hour 0-23;
 *  `name` is optional — when absent (no display name available on the
 *  surface) the greeting falls back to the time-of-day word alone
 *  ("Good morning"), never a placeholder.
 *
 *  Shared so web + mobile read identically when web reaches Today
 *  parity. The time-of-day cut points match the standard greeting
 *  windows (morning < 12, afternoon < 18, else evening).
 *
 *  NOTE: this revives the time-of-day greeting that the 2026-05-22 calm
 *  pass dropped. The Sloe redesign reinstates it as the warm-coaching
 *  hero opener (project_lifesum_aesthetic_direction). */
export function todayGreeting(hour: number, name?: string | null): string {
  const part =
    hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const trimmed = name?.trim();
  return trimmed ? `${part}, ${trimmed}` : `Good ${part.toLowerCase()}`;
}

/** Ordered `user_metadata` keys the Today greeting reads a display name
 *  from. Apple Sign-In writes `full_name` (FULL_NAME scope); the
 *  in-app "Your name" Settings field also writes `full_name` via
 *  `supabase.auth.updateUser({ data: { full_name } })`. The remaining
 *  keys are accepted as fallbacks for accounts whose name arrived via a
 *  different provider. Order = precedence. */
export const GREETING_NAME_METADATA_KEYS = [
  "full_name",
  "name",
  "first_name",
  "preferred_name",
] as const;

/** Extract the first-name token for the Today greeting from a Supabase
 *  auth user's `user_metadata`. Reads the first non-empty value across
 *  {@link GREETING_NAME_METADATA_KEYS} (precedence order), then returns
 *  its first whitespace-delimited token — so "Grace Turner" → "Grace".
 *
 *  Returns `undefined` (never an empty string) when no usable name is
 *  present, so callers can pass the result straight to
 *  {@link todayGreeting} and get the name-free "Good morning" fallback.
 *
 *  We deliberately do NOT fall back to the email local-part: a raw
 *  local-part like "gracemturner" reads worse than a clean, name-free
 *  greeting (matches the mobile Today rationale in
 *  `apps/mobile/app/(tabs)/index.tsx`). Shared so web + mobile resolve
 *  the greeting name identically — pinned by
 *  `tests/unit/greetingNameMetadata.test.ts`. */
export function firstNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  const meta = metadata ?? {};
  let raw = "";
  for (const key of GREETING_NAME_METADATA_KEYS) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) {
      raw = value;
      break;
    }
  }
  const first = raw.trim().split(/\s+/)[0];
  return first || undefined;
}

/** Calm status chip shown above the calorie ring on the Sloe Today hero
 *  (`01 · Today` frame). Three states map to the ring's three states.
 *
 *  IMPORTANT — calm-tone copy: the Sloe HTML mock labelled these "Under
 *  budget" / "{n} over" / "Fresh start", but **"under budget" / "over
 *  budget" are FORBIDDEN_TODAY_PHRASES** (UCL Oct 2025 + ED-cohort harm
 *  rationale, enforced by `todayCopyParity.test.ts`). The chip therefore
 *  ships the calm, already-ratified equivalents:
 *    - empty / nothing logged → "Fresh start"
 *    - logged, at/under target → "On track"  (matches the ratified
 *      `today-status-pills` "On track" phrase)
 *    - logged, over target    → "{n} over"   (factual delta — contains
 *      "over" but not the banned "over budget"/"you went over" bigrams)
 *  Same words web ↔ mobile. */
export function todayStatusChip(
  state: "empty" | "under" | "over",
  overByKcal?: number,
): string {
  if (state === "empty") return "Fresh start";
  if (state === "over") {
    const n = Math.max(0, Math.round(overByKcal ?? 0));
    return `${n.toLocaleString()} over`;
  }
  return "On track";
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

/** The four stat tiles that sit beside the calorie ring on Today.
 *  Order matters — matches the visual 2x2 reading order used on web +
 *  landing (Logged / Target / Burned / Net). */
export const TODAY_STAT_LABELS = {
  logged: "Logged",
  target: "Target",
  burned: "Burned",
  net: "Net",
} as const;

/** Opt-in affordance for inner protein/carbs/fat rings on the calorie
 *  hero. Macros stay hidden by default; the macro tile grid below the
 *  hero is the primary surface. */
export const MACRO_RING_TOGGLE = {
  show: "Show macro rings",
  hide: "Hide macro rings",
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
 *    - Otherwise → "Room for {meal} — about {remaining} kcal to play
 *      with. No rush."
 *
 *  Calm-tone: contains no FORBIDDEN_TODAY_PHRASES; "No rush." is the
 *  permission close (matches the Sloe warm-coaching direction). Shared so
 *  web reads identically if/when it reaches Today parity. */
export function todayRoomForMeal(
  remainingKcal: number,
  nextMeal: TodayMealSlot | null,
): string | null {
  const remaining = Math.round(remainingKcal);
  if (remaining < TODAY_ROOM_MIN_KCAL) return null;
  const kcal = remaining.toLocaleString();
  if (nextMeal == null) {
    return `About ${kcal} kcal left for today. No rush.`;
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
 *  budget" surfaced on the Week-mode Today view (web + mobile);
 *  replaced with the canonical "Net deficit" / "Net surplus"
 *  phrasing per UCL Oct 2025 study + r/loseit data showing
 *  punitive-budget framing drives logging avoidance + ED-cohort
 *  harm. */
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
  "Today's meals",
  "Today’s meals",
] as const;
