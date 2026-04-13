import { describe, expect, it } from "vitest";

describe("JSON-LD XSS prevention", () => {
  function safeJsonLd(obj: unknown): string {
    return JSON.stringify(obj).replace(/</g, "\\u003c");
  }

  it("escapes </script> in recipe title", () => {
    const result = safeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c/script>");
  });

  it("preserves valid content without angle brackets", () => {
    const result = safeJsonLd({ name: "Chicken Tikka Masala", calories: "500 kcal" });
    expect(result).toContain("Chicken Tikka Masala");
    expect(result).toContain("500 kcal");
  });

  it("produces valid JSON after escaping", () => {
    const input = { name: "A <b>bold</b> recipe" };
    const escaped = safeJsonLd(input);
    const parsed = JSON.parse(escaped) as { name: string };
    expect(parsed.name).toBe("A <b>bold</b> recipe");
  });
});
