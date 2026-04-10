import { supabase } from "./browserClient.ts";

const BUCKET = "recipe-images";
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type UploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

/**
 * Upload a recipe cover image to Supabase Storage.
 * Returns the public URL on success.
 *
 * Requires a `recipe-images` bucket in Supabase Storage with:
 * - Public access for reads
 * - Authenticated uploads to `{user_id}/{filename}`
 */
export async function uploadRecipeImage(
  file: File,
  userId: string,
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, and WebP images are supported." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "Image must be under 2 MB." };
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filename = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    // Bucket may not exist yet — provide actionable message
    if (error.message?.includes("not found") || error.message?.includes("Bucket")) {
      return {
        ok: false,
        error: "Image storage is not configured yet. Your recipe will be saved with a default image.",
      };
    }
    return { ok: false, error: error.message };
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filename);

  return { ok: true, publicUrl: urlData.publicUrl };
}
