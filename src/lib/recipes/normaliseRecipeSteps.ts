/**
 * Shared legal guardrail for imported recipe step text (ENG-1128).
 *
 * Recipe ingredient lists are facts (not copyrightable), but a creator's
 * creative expression in step PROSE is. The posture
 * (`docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md`) is:
 * never persist a creator's narrative step prose verbatim.
 *
 * Previously only the caption path (`parseCaption.ts`) rewrote steps to
 * imperative voice; the structured-LLM and JSON-LD/HTML import paths
 * persisted steps essentially verbatim (whitespace-cleanup only). This module
 * centralises the guardrail so it can be enforced at the single persist
 * chokepoint (`persistImportedRecipe.ts`), covering every import path at once.
 *
 * Two layers:
 *   1. `normaliseStepToImperative` — neutralises one step sentence (strips
 *      first-person + conversational filler, capitalises, terminates).
 *   2. `splitIntoImperativeSteps` — sentence-splits a narrative paragraph into
 *      atomic steps, then neutralises each. Imperative-stripping alone leaves
 *      a creator's paragraph largely intact; splitting to functional steps is
 *      what actually de-narrativises long JSON-LD `HowToStep.text` prose.
 *   3. `paraphraseInstructionsField` — the persist-chokepoint transform.
 */

import { normaliseInstructions } from "./normaliseInstructions";

/**
 * Rewrite a single step sentence to imperative voice with neutral phrasing.
 *
 *   - Strips leading first-person voice ("I heat the oil" → "Heat the oil")
 *   - Strips leading "Then, " / "Next, " / "Now " / "So, " filler
 *   - Strips conversational openers ("Okay, ", "Alright, ", "So basically ")
 *   - Capitalises the first letter, ensures a terminating period
 *
 * Exposed so unit tests can assert byte-for-byte on the legal guardrail.
 */
export function normaliseStepToImperative(raw: string): string {
  if (typeof raw !== "string") return "";
  let s = raw.replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Strip leading conversational fillers. Multi-pass to peel back stacked
  // openers like "So basically, then now you want to...".
  const fillers = [
    /^(?:so|okay|ok|alright|right|now|next|then|first(?:ly)?|finally|lastly|after that|after\s+\w+,?|basically|essentially|literally|honestly|actually|simply|just|well)\s*[,.\-:]?\s+/i,
    /^(?:and\s+)?then\s*[,.\-:]?\s+/i,
  ];
  for (let i = 0; i < 6; i++) {
    let changed = false;
    for (const re of fillers) {
      if (re.test(s)) {
        s = s.replace(re, "");
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Convert first-person / second-person voice-over ("I/we/you ...", incl.
  // contractions "I'll / we'll / you'll / you're going to") → imperative.
  s = s.replace(
    /^(?:i'?m\s+going\s+to\s+|i'?ll\s+(?:just\s+|then\s+)?|i\s+(?:am\s+going\s+to\s+|will\s+|just\s+|then\s+|like\s+to\s+)?|we'?ll\s+(?:just\s+|then\s+)?|we\s+(?:are\s+going\s+to\s+|will\s+|just\s+|then\s+)?|you'?re\s+going\s+to\s+|you'?ll\s+(?:want\s+to\s+|need\s+to\s+|just\s+|then\s+)?|you\s+(?:want\s+to\s+|need\s+to\s+|can\s+|just\s+|then\s+|will\s+)?|let'?s\s+(?:just\s+|now\s+)?)/i,
    "",
  );

  // Trim again in case the rewrite left an opening space.
  s = s.trim();
  if (!s) return "";

  // Capitalise first character; ensure terminating period if missing.
  s = s[0].toUpperCase() + s.slice(1);
  if (!/[.!?]$/.test(s)) s = s + ".";

  return s;
}

/**
 * Split a (possibly narrative-paragraph) step into atomic imperative steps.
 *
 * Sentence boundaries: `.`/`!`/`?` followed by whitespace and a capital
 * letter. The capital lookahead deliberately avoids splitting decimals
 * ("1.5 cups") and unit abbreviations ("180C. Add" still splits, "350°F"
 * mid-sentence does not), which is the conservative behaviour we want for
 * recipe step prose. Each resulting sentence is neutralised to imperative.
 */
export function splitIntoImperativeSteps(raw: string): string[] {
  if (typeof raw !== "string") return [];
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => normaliseStepToImperative(s))
    .filter((s) => s.length > 0);
}

/**
 * Guardrail (ENG-1128) — paraphrase a raw `instructions` field (string or
 * string[]) into an array of atomic imperative steps. Whitespace-normalises,
 * splits each line/paragraph on sentence boundaries, and neutralises each to
 * imperative voice. Empty/non-string → [].
 *
 * Used at the **import route** (`app/api/recipe-import/route.ts`) so the
 * response both platforms persist already carries clean steps.
 */
export function paraphraseInstructionsArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((x) =>
      splitIntoImperativeSteps(normaliseInstructions(String(x))),
    );
  }
  if (typeof raw === "string") {
    return normaliseInstructions(raw)
      .split(/\n+/)
      .flatMap((line) => splitIntoImperativeSteps(line));
  }
  return [];
}

/**
 * Same guardrail, joined one-step-per-line. Returns null when empty.
 *
 * Used at the web persist chokepoint (`persistImportedRecipe.ts`) as
 * defence-in-depth — idempotent if the route already paraphrased, and it also
 * covers the save-first / update-import persist paths.
 */
export function paraphraseInstructionsField(raw: unknown): string | null {
  const steps = paraphraseInstructionsArray(raw);
  return steps.length ? steps.join("\n") : null;
}
