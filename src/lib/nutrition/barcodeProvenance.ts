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
