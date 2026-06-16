import { sanitiseAiItems, type AiLoggedItem } from "./aiLogging.ts";

/** Heuristic: search query reads like a meal description, not a brand lookup. */
export function looksLikeMealDescription(query: string): boolean {
  const text = query.trim();
  if (text.length < 8) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return true;
  if (words.length >= 2 && /\d/.test(text)) return true;
  return /\b(and|with|for breakfast|for lunch|for dinner|ate|had|scrambled|slice|cup|bowl|toast|eggs)\b/i.test(
    text,
  );
}

export type ParseMealDescriptionResult =
  | { ok: true; items: AiLoggedItem[] }
  | { ok: false; error: string; upgradeRequired?: boolean };

/**
 * Parse natural-language meal text via the shared voice-log pipeline
 * (LLM itemisation + verified nutrition lookup). Used by VoiceLogSheet
 * and the LogSheet inline describe flow (ENG-972).
 */
export async function parseMealDescriptionTranscript(opts: {
  transcript: string;
  apiBase?: string;
  accessToken?: string | null;
}): Promise<ParseMealDescriptionResult> {
  const trimmed = opts.transcript.trim();
  if (!trimmed) {
    return { ok: false, error: "Describe what you ate first." };
  }

  const base = (opts.apiBase ?? "").replace(/\/$/, "");
  const url = base ? `${base}/api/nutrition/voice-log` : "/api/nutrition/voice-log";

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.accessToken ? { Authorization: `Bearer ${opts.accessToken}` } : {}),
      },
      body: JSON.stringify({ transcript: trimmed }),
    });
    const data = (await resp.json()) as {
      ok?: boolean;
      items?: unknown[];
      error?: string;
      message?: string;
    };

    if (resp.status === 403 && data?.error === "upgrade_required") {
      return {
        ok: false,
        upgradeRequired: true,
        error:
          typeof data.message === "string"
            ? data.message
            : "Describe logging is a Pro feature. Upgrade to use it.",
      };
    }

    if (!data?.ok || !Array.isArray(data.items)) {
      return {
        ok: false,
        error:
          typeof data?.message === "string"
            ? data.message
            : "Could not parse your description. Try again.",
      };
    }

    const cleaned = sanitiseAiItems(data.items, "voice");
    if (cleaned.length === 0) {
      return {
        ok: false,
        error: "No food items could be parsed. Try describing portions too.",
      };
    }

    return { ok: true, items: cleaned };
  } catch {
    return {
      ok: false,
      error: "Parsing failed. Check your connection and try again.",
    };
  }
}
