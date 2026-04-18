/**
 * Mobile re-export of the shared Siri deep-link helper — Batch 5.12.
 *
 * Lets `@/lib/siriDeepLinks` resolve through the existing mobile alias
 * without bundler changes. All logic lives in `src/lib/nutrition/siriDeepLinks.ts`
 * so the schema stays owned in one place per `.claude/CLAUDE.md` parity rule.
 */
export {
  parseSiriDeepLink,
  buildLogWaterUrl,
  buildStartFastUrl,
  TODAY_REMAINING_URL,
  SIRI_DEFAULT_WATER_ML,
  SIRI_DEFAULT_FAST_HOURS,
  type SiriAction,
} from "../../../src/lib/nutrition/siriDeepLinks";
