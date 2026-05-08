/**
 * Normalize an incoming photo upload (any iOS/Android camera or library
 * format) to a JPEG buffer + clean media_type before passing to a
 * vision API. Anthropic only accepts `image/jpeg|png|gif|webp` — iPhone
 * captures HEIC by default which Claude rejects with a 400.
 *
 * 2026-05-08 build-46/47 hotfix — scan-label was returning 502 with
 * Anthropic's "invalid base64 image" / "image_format_not_supported"
 * error because we passed `media_type: image/heic` straight through.
 *
 * This helper:
 *   - Detects the actual image format from magic bytes (not the mime
 *     type the client claimed — clients lie / mislabel)
 *   - Re-encodes to JPEG quality 85 (parity with the existing
 *     ImagePicker quality setting on the client side)
 *   - Caps the longest edge at 2048px so we don't blow Anthropic's
 *     per-image token budget on multi-MB iPhone photos
 *   - Returns the JPEG bytes + a clean `image/jpeg` media_type
 */

import sharp from "sharp";

export type NormalizedImage = {
  buffer: Buffer;
  mediaType: "image/jpeg";
  /** Detected source format (sniffed from magic bytes, not the
   *  client-claimed mime). Useful for telemetry. */
  sourceFormat: string;
};

/** Apple's standard "image/heic" + "image/heif" magic bytes are the
 *  ftyp box at offset 4. Sharp can read HEIC via libheif when the
 *  Vercel build includes it (it does as of sharp 0.34). */
function sniffFormat(buf: Buffer): string {
  if (buf.length < 12) return "unknown";
  // JPEG: starts FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  // GIF: 47 49 46 38
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return "image/gif";
  }
  // WebP: RIFF....WEBP at offset 0/8
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  // HEIC/HEIF: ftyp box at offset 4. Common brands: heic, heix, mif1.
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    const brand = buf.slice(8, 12).toString("ascii");
    if (
      brand === "heic" ||
      brand === "heix" ||
      brand === "mif1" ||
      brand === "msf1" ||
      brand === "hevc" ||
      brand === "hevx"
    ) {
      return "image/heic";
    }
    return "image/heif"; // catchall for other ISOBMFF variants
  }
  return "unknown";
}

export async function normalizeImageForAi(
  buf: Buffer,
  options?: { maxEdgePx?: number; quality?: number },
): Promise<NormalizedImage> {
  const sourceFormat = sniffFormat(buf);
  const maxEdgePx = options?.maxEdgePx ?? 2048;
  const quality = options?.quality ?? 85;

  // sharp handles HEIC, JPEG, PNG, WebP, GIF, AVIF, TIFF on Vercel's
  // Linux runtime. Unknown formats fall through and may throw —
  // caller catches.
  const out = await sharp(buf, { failOn: "warning" })
    .rotate() // auto-orient via EXIF (iPhone landscape photos)
    .resize({
      width: maxEdgePx,
      height: maxEdgePx,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  return { buffer: out, mediaType: "image/jpeg", sourceFormat };
}
