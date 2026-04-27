import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const lineUserId = request.nextUrl.searchParams.get("lineUserId");
    if (!lineUserId) {
      return NextResponse.json({ error: "lineUserId is required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const orders = await prisma.order.findMany({
      where: { customerId: customer.id },
      include: { items: true, delivery: true },
      orderBy: { createdAt: "desc" },
    });

    const formatted = orders.map((o) => ({
      orderId: o.orderId,
      items: o.items.map((i) => ({
        name: i.itemName,
        qty: i.quantity,
        price: i.price,
      })),
      status: o.status,
      totalAmount: o.totalAmount,
      date: o.orderDate.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      requestedDeliveryDate: o.requestedDeliveryDate
        ? o.requestedDeliveryDate.toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : null,
      deliveryStatus: o.delivery?.status || null,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch customer orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
