/**
 * Decode HTML character references and a few named entities that often
 * leak through social meta tags / Instagram captions before they hit RN.
 */

function codepointToChar(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "\ufffd";
  if (cp > 0xffff) {
    const u = cp - 0x10000;
    return String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
  }
  return String.fromCharCode(cp);
}

/** Decode common HTML entities (decimal, hex, and a small named set). */
export function decodeHtmlEntities(s: string | null | undefined): string {
  if (s == null || s === "") return "";
  if (!s.includes("&")) return s;

  let out = s
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex) => codepointToChar(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_, dec) => codepointToChar(Number(dec)));

  out = out
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");

  // Normalise curly quotes (common after `&#x2019;` etc.) to ASCII for
  // search, CSV, and tests that expect straight quotes.
  return out
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"');
}
