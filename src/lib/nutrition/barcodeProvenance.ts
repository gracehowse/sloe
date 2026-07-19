/**
 * Barcode scan provenance copy — shared web + mobile (ENG-1251 P1-C).
 *
 * Distinguishes the viewer's own pending submission ("Not yet confirmed")
 * from community-verified rows and Open Food Facts fallbacks.
 */
export function barcodeProvenanceLabel(product: {
  verified?: boolean;
  source?: string;
  verificationStatus?: "pending" | "verified" | "rejected";
  isOwnSubmission?: boolean;
}): string {
  if (product.isOwnSubmission && product.verificationStatus === "pending") {
    return "Not yet confirmed";
  }
  if (product.verified || product.verificationStatus === "verified") {
    return "Verified entry";
  }
  if (product.source === "user") return "Community submitted";
  return "via Open Food Facts";
}

type BarcodeProvenanceProduct = Parameters<typeof barcodeProvenanceLabel>[0];

/**
 * Canonical source name for the trust chip (ENG-1567).
 *
 * The verified barcode corpus is assembled from promoted community entries,
 * so "Sloe community" is the honest provenance name. Raw external fallbacks
 * name Open Food Facts directly; pending community rows keep their submission
 * provenance but remain Estimated in the confidence classifier.
 */
export function barcodeTrustSourceName(product: BarcodeProvenanceProduct): string {
  if (product.verified || product.verificationStatus === "verified") {
    return "Sloe community";
  }
  if (product.source === "user") return "Community submitted";
  return "Open Food Facts";
}

/** Default-on provenance line that removes the retired generic trust claim. */
export function barcodeTrustProvenanceLabel(
  product: BarcodeProvenanceProduct,
): string {
  if (product.isOwnSubmission && product.verificationStatus === "pending") {
    return "Not yet confirmed";
  }
  if (product.verified || product.verificationStatus === "verified") {
    return "Sloe community";
  }
  if (product.source === "user") return "Community submitted";
  return "via Open Food Facts";
}
