/**
 * Contextual in-app help registry (ENG-1597 scope, ENG-1598 implementation).
 *
 * User-facing guidance copy for loop-aware help surfaces. Journey docs under
 * `docs/journeys/*` are the authoring reference; this module is the runtime
 * single source so web ↔ mobile never drift.
 *
 * Presentation (ⓘ trigger → sheet/dialog, session-limited coach rails) is
 * implemented in ENG-1598. This file owns IDs, copy, gate helpers, and
 * persistence key constants only.
 */

/** Feature flag — default OFF until sim-validated (see spec §6). */
export const CONTEXTUAL_HELP_FLAG = "contextual_help_v1" as const;

/**
 * Per-device set of topic IDs the user explicitly dismissed (ⓘ sheets).
 * Comma-separated topic IDs, versioned for clean resets.
 */
export const CONTEXTUAL_HELP_DISMISSED_KEY =
  "suppr-contextual-help-dismissed-v1" as const;

/**
 * Per-device session counter for auto coach-rails (e.g. post-save "what's next").
 * JSON map: `{ [topicId]: sessionCount }`, versioned.
 */
export const CONTEXTUAL_HELP_SESSION_KEY =
  "suppr-contextual-help-session-v1" as const;

/** Highest session number that still shows a coach rail (matches aiMethodTooltip). */
export const MAX_COACH_RAIL_SESSION = 3 as const;

/** Stable IDs for registered help topics. Extend per phase in the spec. */
export type HelpTopicId =
  | "import.how_it_works"
  | "import.confidence_scores"
  | "verify.why_verify"
  | "capture.post_save_next"
  | "recipe.save_vs_log";

export type HelpContent = {
  title: string;
  /** Short paragraphs — rendered in order inside the sheet/dialog. */
  paragraphs: readonly string[];
  /** Optional deep link to web `/help` anchor (mobile opens via Linking). */
  learnMorePath?: string;
};

/**
 * Phase 1 — Recipe Capture loop. Pinned by `tests/unit/contextualHelp.test.ts`.
 * Copy sourced from journey docs + `/help` user-safe framing, not verbatim
 * internal wiki text.
 */
export const CONTEXTUAL_HELP_REGISTRY: Record<HelpTopicId, HelpContent> = {
  "import.how_it_works": {
    title: "How import works",
    paragraphs: [
      "You share a link or photo and Sloe makes a personal copy in your cookbook — like saving to your notes.",
      "We parse ingredients and steps, estimate nutrition from real food databases, and link back to the original. Your import stays private unless you choose to share it.",
    ],
    learnMorePath: "/help#importing-recipes",
  },
  "import.confidence_scores": {
    title: "Ingredient confidence",
    paragraphs: [
      "Each ingredient gets a match score. High means a close fit to a verified database entry. Low means we used a weaker match or estimate.",
      "Low-confidence ingredients are flagged for review — they are excluded from headline totals until you verify them.",
    ],
    learnMorePath: "/help#methodology",
  },
  "verify.why_verify": {
    title: "Why verify ingredients?",
    paragraphs: [
      "Import estimates nutrition from each ingredient match — some matches are low-confidence.",
      "Flagged rows are excluded from headline totals until you confirm or fix them.",
      "Tap Fix (or the row) to search a better food match; Save locks the recipe into your Library.",
      "You can always re-open verify later from the recipe — nothing is permanent until you trust it.",
    ],
    learnMorePath: "/help#methodology",
  },
  "capture.post_save_next": {
    title: "What to do next",
    paragraphs: [
      "Review any flagged ingredients so your totals are trustworthy.",
      "Find this recipe in your Library, add it to a meal plan, cook with Cook Mode, or log a serving to Today.",
    ],
  },
  "recipe.save_vs_log": {
    title: "Save vs log",
    paragraphs: [
      "Save keeps the recipe in your Library for later — it does not add anything to today's diary.",
      "Log records what you ate today and updates your macro ring. You can log from a saved recipe any time.",
    ],
  },
};

export type ContextualHelpGateInput = {
  flagOn: boolean;
  topicId: HelpTopicId;
  /** Topic IDs the user permanently dismissed on this device. */
  dismissedTopics: ReadonlySet<string>;
  /**
   * 1-based session count for coach-rail topics. Omit for ⓘ trigger topics
   * (always available until dismissed when flag is on).
   */
  coachRailSession?: number;
};

/**
 * Decide whether a contextual help surface should render.
 * Coach-rail topics (`capture.post_save_next`) also require session ≤ MAX.
 */
export function shouldShowContextualHelp(input: ContextualHelpGateInput): boolean {
  const { flagOn, topicId, dismissedTopics, coachRailSession } = input;
  if (!flagOn) return false;
  if (!CONTEXTUAL_HELP_REGISTRY[topicId]) return false;
  if (dismissedTopics.has(topicId)) return false;

  if (topicId === "capture.post_save_next") {
    if (coachRailSession == null || !Number.isFinite(coachRailSession)) return false;
    if (coachRailSession < 1) return false;
    if (coachRailSession > MAX_COACH_RAIL_SESSION) return false;
  }

  return true;
}

/** Parse comma-separated dismissed topic IDs from storage. */
export function parseDismissedTopics(raw: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (typeof raw !== "string" || raw.length === 0) return out;
  for (const piece of raw.split(",")) {
    const id = piece.trim();
    if (id in CONTEXTUAL_HELP_REGISTRY) out.add(id);
  }
  return out;
}

export function serializeDismissedTopics(set: ReadonlySet<string>): string {
  return [...set].filter((id) => id in CONTEXTUAL_HELP_REGISTRY).join(",");
}

/** Parse session map JSON; malformed → empty object. */
export function parseCoachRailSessions(
  raw: string | null | undefined,
): Record<string, number> {
  if (typeof raw !== "string" || raw.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, number> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
        out[key] = Math.trunc(val);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Increment session count for a coach-rail topic; caps at MAX + 1. */
export function nextCoachRailSession(persisted: number): number {
  const base = Number.isFinite(persisted) && persisted > 0 ? persisted : 0;
  return Math.min(base + 1, MAX_COACH_RAIL_SESSION + 1);
}

export function serializeCoachRailSessions(
  map: Record<string, number>,
): string {
  return JSON.stringify(map);
}
