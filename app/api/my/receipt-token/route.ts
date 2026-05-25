import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hmacSign } from "@/lib/session";
import { apiError, getRequestLang } from "@/lib/api-i18n";

// Issues an HMAC signature for /api/receipt/[orderId] so the customer can
// view their own receipt image without a staff session. The signature is
// short-lived in spirit (orderId-bound) and only granted after we confirm
// the requesting LINE user actually owns the order.
export async function GET(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const lineUserId = request.nextUrl.searchParams.get("lineUserId");
    const orderId = request.nextUrl.searchParams.get("orderId");
    if (!lineUserId || !orderId) {
      return apiError(lang, "missing_fields", 400);
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      select: { customer: { select: { lineUserId: true } } },
    });
    if (!order || order.customer?.lineUserId !== lineUserId) {
      return apiError(lang, "order_not_found", 404);
    }

    const sig = await hmacSign(`receipt:${orderId}`);
    return NextResponse.json({ sig });
  } catch (error) {
    console.error("Failed to issue receipt token:", error);
    return apiError(lang, "generic_error", 500);
  }
}
