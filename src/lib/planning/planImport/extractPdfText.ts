import { extractText, getDocumentProxy } from "unpdf";

const MIN_EXTRACTED_LEN = 80;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true as const });
  const joined = text.replace(/\s+\n/g, "\n").trim();
  if (joined.length < MIN_EXTRACTED_LEN) {
    throw new Error("pdf_text_too_short");
  }
  return joined.slice(0, 64_000);
}
