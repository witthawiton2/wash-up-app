import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTime } from "@/lib/timezone";
import { apiError, getRequestLang } from "@/lib/api-i18n";
import { parseDeliveryPhotos } from "@/lib/delivery-photos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const lang = getRequestLang(request);
  try {
    const { orderId } = await params;
    const lineUserId = request.nextUrl.searchParams.get("lineUserId");
    if (!lineUserId || !orderId) {
      return apiError(lang, "missing_fields", 400);
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: {
        customer: { select: { id: true, name: true, phone: true, address: true, lineUserId: true } },
        items: { select: { itemName: true, quantity: true, price: true } },
        delivery: { select: { status: true, photoUrl: true, address: true, date: true } },
      },
    });

    if (!order || order.customer?.lineUserId !== lineUserId) {
      return apiError(lang, "order_not_found", 404);
    }

    const itemNames = order.items.map((i) => i.itemName);
    const services = itemNames.length
      ? await prisma.serviceItem.findMany({
          where: { name: { in: itemNames } },
          select: { name: true, nameEn: true },
        })
      : [];
    const nameEnMap = new Map(services.map((s) => [s.name, s.nameEn]));

    return NextResponse.json({
      orderId: order.orderId,
      status: order.status,
      orderDate: formatDateTime(order.orderDate),
      requestedDeliveryDate: order.requestedDeliveryDate
        ? formatDate(order.requestedDeliveryDate)
        : null,
      items: order.items.map((i) => ({
        name: i.itemName,
        nameEn: nameEnMap.get(i.itemName) || null,
        qty: i.quantity,
        price: i.price,
      })),
      totalAmount: order.totalAmount,
      discount: order.discount,
      hangersOwned: order.hangersOwned,
      hangersBought: order.hangersBought,
      note: order.note,
      paymentStatus: order.paymentStatus,
      paymentSlipUrl: order.paymentSlipUrl,
      customer: {
        name: order.customer?.name || "",
        phone: order.customer?.phone || "",
        address: order.customer?.address || "",
      },
      delivery: order.delivery
        ? {
            status: order.delivery.status,
            address: order.delivery.address,
            date: order.delivery.date ? formatDate(order.delivery.date) : null,
            photos: parseDeliveryPhotos(order.delivery.photoUrl),
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch order detail:", error);
    return apiError(lang, "generic_error", 500);
  }
}
