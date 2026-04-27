import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: { requestedDeliveryDate: { not: null } },
      include: { customer: true, items: true },
      orderBy: { requestedDeliveryDate: "asc" },
    });

    const bookings = orders.map((o) => ({
      orderId: o.orderId,
      customer: o.customer
        ? `${o.customer.customerCode ? o.customer.customerCode + " " : ""}${o.customer.name}`
        : o.walkInName || "",
      phone: o.customer?.phone || "",
      items: o.items.map((i) => ({ name: i.itemName, qty: i.quantity })),
      status: o.status,
      requestedDate: o.requestedDeliveryDate!.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      requestedTime: o.requestedDeliveryDate!.toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      note: o.note || "",
      orderDate: o.orderDate.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    }));

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
