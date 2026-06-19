import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_UPLOAD = readFileSync(
  resolve(__dirname, "../../src/app/components/RecipeUpload.tsx"),
  "utf8",
);
const WEB_CARD = readFileSync(
  resolve(__dirname, "../../src/app/components/import/ImportCaptionPreviewCard.tsx"),
  "utf8",
);
const MOBILE = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/import-shared.tsx"),
  "utf8",
);

describe("Import caption preview — ENG-898 web parity", () => {
  it("gates web caption preview behind import_caption_preview_v1", () => {
    expect(WEB_UPLOAD).toMatch(/isFeatureEnabled\("import_caption_preview_v1"\)/);
    expect(WEB_UPLOAD).toMatch(/ImportCaptionPreviewCard/);
    expect(WEB_UPLOAD).toMatch(/fetchCaptionImportedRecipe/);
    expect(WEB_UPLOAD).toMatch(/\/api\/recipe-import\/caption/);
  });

  it("routes IG/TT/YT URLs to preview before executeUrlImport", () => {
    expect(WEB_UPLOAD).toMatch(/detectSourcePlatform\(u\)/);
    expect(WEB_UPLOAD).toMatch(/isCaptionTextPlatform\(platform\)/);
    expect(WEB_UPLOAD).toMatch(/setImportCaptionPreviewOpen\(true\)/);
  });

  it("renders trust copy + escape hatches on the web card", () => {
    expect(WEB_CARD).toMatch(/We never fetch the post itself/);
    expect(WEB_CARD).toMatch(/caption-preview-photo-escape/);
    expect(WEB_CARD).toMatch(/caption-preview-link-escape/);
    expect(WEB_CARD).toMatch(/Looks right — import it/);
  });
});

describe("Import caption preview — mobile escape hatches", () => {
  it("adds photo + link escape rows on captionPreview", () => {
    expect(MOBILE).toMatch(/caption-preview-photo-escape/);
    expect(MOBILE).toMatch(/caption-preview-link-escape/);
    expect(MOBILE).toMatch(/Import from a photo instead/);
    expect(MOBILE).toMatch(/Import from link only/);
  });
});
