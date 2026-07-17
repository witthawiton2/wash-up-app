import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdminLine } from "@/lib/notify-admin";
import { apiError, getRequestLang } from "@/lib/api-i18n";
import { resolveLineUser } from "@/lib/line-auth";

function isValidSlipUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    // Match against the configured Supabase project — covers
    // <project>.supabase.co and any custom storage hostname set via env.
    const supabaseHost = process.env.SUPABASE_URL
      ? new URL(process.env.SUPABASE_URL).hostname
      : null;
    if (supabaseHost && u.hostname === supabaseHost) return true;
    if (u.hostname.endsWith(".supabase.co")) return true;
    return false;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const body = await request.json();
    const { lineUserId: claimed, orderId, slipUrl } = body;
    const auth = await resolveLineUser(request, claimed);
    if ("error" in auth) return apiError(lang, "generic_error", auth.status);
    const lineUserId = auth.userId;

    if (!orderId || !slipUrl) {
      return apiError(lang, "missing_fields", 400);
    }

    // Only accept slip URLs we ourselves issued (Supabase storage bucket
    // configured in SUPABASE_URL). Stops clients from pointing the field
    // at arbitrary external images.
    if (!isValidSlipUrl(slipUrl)) {
      return apiError(lang, "invalid_slip_url", 400);
    }

    const customer = await prisma.customer.findUnique({ where: { lineUserId } });
    if (!customer) {
      return apiError(lang, "customer_not_found", 404);
    }

    const order = await prisma.order.findUnique({ where: { orderId } });
    if (!order || order.customerId !== customer.id) {
      return apiError(lang, "order_not_found", 404);
    }

    await prisma.order.update({
      where: { orderId },
      data: {
        paymentSlipUrl: slipUrl,
        paymentStatus: "pending",
      },
    });

    notifyAdminLine(`💰 มีสลิปการชำระใหม่!\n\nลูกค้า: ${customer.name}\nออเดอร์: ${orderId}\nยอด: ${order.totalAmount.toLocaleString()}฿\n\nกรุณาตรวจสอบที่หน้า Payments`).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to upload payment slip:", error);
    return apiError(lang, "upload_failed", 500);
  }
}
