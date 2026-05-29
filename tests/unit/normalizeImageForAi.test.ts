/**
 * @vitest-environment node
 *
 * Real sharp pipeline — route integration tests mock this module and
 * defer coverage here.
 */
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import { normalizeImageForAi } from "@/lib/server/normalizeImageForAi";

describe("normalizeImageForAi", () => {
  it("converts PNG input to JPEG with expected metadata", async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#ff0000" },
    })
      .png()
      .toBuffer();

    const result = await normalizeImageForAi(png);
    expect(result.mediaType).toBe("image/jpeg");
    expect(result.sourceFormat).toBe("image/png");
    expect(result.buffer.subarray(0, 2).toString("hex")).toBe("ffd8");
  });

  it("respects maxEdgePx and quality options", async () => {
    const png = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "#00ff00" },
    })
      .png()
      .toBuffer();

    const result = await normalizeImageForAi(png, { maxEdgePx: 512, quality: 70 });
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(512);
    expect(meta.height).toBeLessThanOrEqual(512);
  });
});
