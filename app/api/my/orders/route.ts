import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/timezone";
import { apiError, getRequestLang } from "@/lib/api-i18n";
import { parseDeliveryPhotos } from "@/lib/delivery-photos";
import { resolveLineUser } from "@/lib/line-auth";

export async function GET(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const claimed = request.nextUrl.searchParams.get("lineUserId");
    const auth = await resolveLineUser(request, claimed);
    if ("error" in auth) return apiError(lang, "generic_error", auth.status);
    const lineUserId = auth.userId;

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
      select: { id: true },
    });
    if (!customer) {
      return apiError(lang, "customer_not_found", 404);
    }

    // Customer portal shows recent activity, not full lifetime history.
    const from = new Date();
    from.setDate(from.getDate() - 60);

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id, createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        orderId: true,
        status: true,
        totalAmount: true,
        orderDate: true,
        requestedDeliveryDate: true,
        paymentStatus: true,
        paymentSlipUrl: true,
        items: { select: { itemName: true, quantity: true, price: true } },
        delivery: { select: { photoUrl: true } },
      },
    });

    const itemNames = Array.from(
      new Set(orders.flatMap((o) => o.items.map((i) => i.itemName)))
    );
    const services = itemNames.length
      ? await prisma.serviceItem.findMany({
          where: { name: { in: itemNames } },
          select: { name: true, nameEn: true },
        })
      : [];
    const nameEnMap = new Map(services.map((s) => [s.name, s.nameEn]));

    const formatted = orders.map((o) => ({
      orderId: o.orderId,
      items: o.items.map((i) => ({
        name: i.itemName,
        nameEn: nameEnMap.get(i.itemName) || null,
        qty: i.quantity,
        price: i.price,
      })),
      status: o.status,
      totalAmount: o.totalAmount,
      date: formatDate(o.orderDate),
      requestedDeliveryDate: o.requestedDeliveryDate
        ? formatDate(o.requestedDeliveryDate)
        : null,
      deliveryPhotos: parseDeliveryPhotos(o.delivery?.photoUrl),
      paymentStatus: o.paymentStatus,
      paymentSlipUrl: o.paymentSlipUrl,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch customer orders:", error);
    return apiError(lang, "generic_error", 500);
  }
}
