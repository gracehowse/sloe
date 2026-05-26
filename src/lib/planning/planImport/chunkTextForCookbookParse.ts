/** Target chunk size for cookbook LLM passes (under 48k model slice). */
export const COOKBOOK_CHUNK_SIZE = 40_000;
export const COOKBOOK_CHUNK_OVERLAP = 2_000;

/**
 * Split long extracted PDF text into parseable chunks.
 * Prefers form-feed page breaks; falls back to overlapping windows.
 */
export function chunkTextForCookbookParse(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= COOKBOOK_CHUNK_SIZE) return [trimmed];

  const pageParts = trimmed.split(/\f+/).map((p) => p.trim()).filter(Boolean);
  if (pageParts.length > 1) {
    const merged: string[] = [];
    let buf = "";
    for (const page of pageParts) {
      const next = buf ? `${buf}\f${page}` : page;
      if (next.length > COOKBOOK_CHUNK_SIZE && buf.length > 0) {
        merged.push(buf);
        buf = page;
      } else {
        buf = next;
      }
    }
    if (buf) merged.push(buf);
    if (merged.length > 1) return merged;
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + COOKBOOK_CHUNK_SIZE, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end >= trimmed.length) break;
    start = Math.max(0, end - COOKBOOK_CHUNK_OVERLAP);
  }
  return chunks;
}
