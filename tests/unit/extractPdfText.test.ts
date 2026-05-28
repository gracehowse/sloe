/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("unpdf", () => ({
  getDocumentProxy: vi.fn(),
  extractText: vi.fn(),
}));

import { extractText, getDocumentProxy } from "unpdf";
import { extractPdfText } from "@/lib/planning/planImport/extractPdfText";

const mockGetDocumentProxy = getDocumentProxy as ReturnType<typeof vi.fn>;
const mockExtractText = extractText as ReturnType<typeof vi.fn>;

describe("extractPdfText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocumentProxy.mockResolvedValue({});
  });

  it("returns trimmed merged text under 64k cap", async () => {
    const text =
      `${"Recipe line with enough content to pass the minimum length gate. ".repeat(3)}\n\nSecond recipe block`;
    mockExtractText.mockResolvedValue({ text });
    const out = await extractPdfText(Buffer.from("pdf-bytes"));
    expect(out).toBe(text.replace(/\s+\n/g, "\n").trim());
    expect(mockGetDocumentProxy).toHaveBeenCalled();
  });

  it("throws pdf_text_too_short when extracted text is tiny", async () => {
    mockExtractText.mockResolvedValue({ text: "too short" });
    await expect(extractPdfText(Buffer.from("pdf"))).rejects.toThrow("pdf_text_too_short");
  });
});
