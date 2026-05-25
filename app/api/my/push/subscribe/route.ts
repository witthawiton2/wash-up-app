import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, getRequestLang } from "@/lib/api-i18n";

export async function POST(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const body = await request.json();
    const { lineUserId, subscription, userAgent } = body as {
      lineUserId?: string;
      subscription?: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      userAgent?: string;
    };

    if (!lineUserId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return apiError(lang, "missing_fields", 400);
    }

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
      select: { id: true },
    });
    if (!customer) return apiError(lang, "customer_not_found", 404);

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        customerId: customer.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      },
      update: {
        customerId: customer.id,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save push subscription:", error);
    return apiError(lang, "generic_error", 500);
  }
}
