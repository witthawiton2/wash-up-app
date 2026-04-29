import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage } from "@/lib/line-api";
import { formatDateTime } from "@/lib/timezone";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: { paymentStatus: { not: "paid" } },
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
    });

    const payments = orders.map((o) => ({
      orderId: o.orderId,
      customer: o.customer
        ? `${o.customer.customerCode ? o.customer.customerCode + " " : ""}${o.customer.name}`
        : o.walkInName || "",
      phone: o.customer?.phone || "",
      lineUserId: o.customer?.lineUserId || "",
      items: o.items.map((i) => ({ name: i.itemName, qty: i.quantity, price: i.price })),
      totalAmount: o.totalAmount,
      paymentSlipUrl: o.paymentSlipUrl,
      paymentStatus: o.paymentStatus,
      orderDate: formatDateTime(o.orderDate),
      status: o.status,
    }));

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, action } = body; // action: "confirm" | "reject"

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { customer: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (action === "confirm") {
      await prisma.order.update({
        where: { orderId },
        data: { paymentStatus: "paid", paidAt: new Date() },
      });

      if (order.customer?.lineUserId) {
        pushTextMessage(
          order.customer.lineUserId,
          `✅ ยืนยันการชำระเงินแล้ว!\n\nออเดอร์: ${orderId}\nยอด: ${order.totalAmount.toLocaleString()}฿\n\nขอบคุณที่ใช้บริการครับ 🙏`
        ).catch(() => {});
      }
    } else if (action === "reject") {
      await prisma.order.update({
        where: { orderId },
        data: { paymentStatus: "unpaid", paymentSlipUrl: null },
      });

      if (order.customer?.lineUserId) {
        pushTextMessage(
          order.customer.lineUserId,
          `❌ สลิปไม่ถูกต้อง\n\nออเดอร์: ${orderId}\n\nกรุณาส่งสลิปการชำระเงินใหม่อีกครั้งครับ`
        ).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update payment:", error);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}
