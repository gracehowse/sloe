import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "../../src/lib/text/decodeHtmlEntities.ts";

describe("decodeHtmlEntities", () => {
  it("decodes hex numeric entities", () => {
    expect(decodeHtmlEntities("you&#x2019;re")).toBe("you're");
    expect(decodeHtmlEntities("&#x2014;")).toBe("—");
  });

  it("decodes decimal numeric entities", () => {
    expect(decodeHtmlEntities("&#064;bettine")).toBe("@bettine");
    expect(decodeHtmlEntities("&#39;s")).toBe("'s");
  });

  it("decodes named entities after numerics", () => {
    expect(decodeHtmlEntities("a &amp; b")).toBe("a & b");
  });

  it("returns plain strings unchanged when no ampersand", () => {
    expect(decodeHtmlEntities("plain")).toBe("plain");
  });
});
