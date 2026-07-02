import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { apiError, getRequestLang } from "@/lib/api-i18n";

export async function POST(request: NextRequest) {
  const lang = getRequestLang(request);
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Body isn't valid multipart — treat as "no file" rather than server error.
    return apiError(lang, "no_file", 400);
  }
  try {
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError(lang, "no_file", 400);
    }

    if (!file.type.startsWith("image/")) {
      return apiError(lang, "invalid_file_type", 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return apiError(lang, "file_too_large", 400);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `delivery-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("delivery-photos")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return apiError(lang, "upload_failed", 500);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("delivery-photos")
      .getPublicUrl(filename);

    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return apiError(lang, "upload_failed", 500);
  }
}
