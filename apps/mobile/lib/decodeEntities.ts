/** Decode common HTML entities that may leak through recipe data. */
export function decodeEntities(s: string): string {
  if (!s || !s.includes("&")) return s;
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/gi, " ");
}
