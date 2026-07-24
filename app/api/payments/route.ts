import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage } from "@/lib/line-api";
import { formatDateTime } from "@/lib/timezone";
import { sendCustomerPush } from "@/lib/push";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const where: Record<string, unknown> = {};
    if (statusParam === "paid") {
      where.paymentStatus = "paid";
      // Date range filter on paidAt (Asia/Bangkok wall-clock from input)
      if (fromParam || toParam) {
        const paidAt: Record<string, Date> = {};
        if (fromParam) paidAt.gte = new Date(`${fromParam}T00:00:00+07:00`);
        if (toParam) paidAt.lte = new Date(`${toParam}T23:59:59+07:00`);
        where.paidAt = paidAt;
      }
    } else {
      where.paymentStatus = { not: "paid" };
      // Zero-total bills carry nothing to pay — keep them out of the
      // "needs payment" list entirely.
      where.totalAmount = { gt: 0 };
      // Bound non-paid view to the last 60 days so the list doesn't grow
      // forever with stale orders.
      const from = new Date();
      from.setDate(from.getDate() - 60);
      where.createdAt = { gte: from };
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: statusParam === "paid" ? { paidAt: "desc" } : { createdAt: "desc" },
      take: 500,
      select: {
        orderId: true,
        totalAmount: true,
        paymentSlipUrl: true,
        paymentStatus: true,
        paidAt: true,
        orderDate: true,
        status: true,
        walkInName: true,
        customer: {
          select: { customerCode: true, name: true, phone: true, lineUserId: true },
        },
        items: { select: { itemName: true, quantity: true, price: true } },
      },
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
      paidAt: o.paidAt ? formatDateTime(o.paidAt) : null,
      orderDate: formatDateTime(o.orderDate),
      status: o.status,
    }));

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Failed to fetch payments:", error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

const ALLOWED_METHODS = new Set(["cash", "qr_promptpay", "bank_transfer", "other"]);

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, action, method } = body; // action: "confirm" | "reject"

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { customer: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    if (action === "confirm") {
      const safeMethod = ALLOWED_METHODS.has(method) ? method : "cash";
      await prisma.order.update({
        where: { orderId },
        data: { paymentStatus: "paid", paidAt: new Date(), paymentMethod: safeMethod },
      });

      if (order.customer?.lineUserId) {
        pushTextMessage(
          order.customer.lineUserId,
          `✅ ยืนยันการชำระเงินแล้ว!\n\nออเดอร์: ${orderId}\nยอด: ${order.totalAmount.toLocaleString()}฿\n\nขอบคุณที่ใช้บริการครับ 🙏`
        ).catch(() => {});
      }
      if (order.customer?.id) {
        sendCustomerPush(order.customer.id, {
          title: "ยืนยันการชำระแล้ว ✅",
          body: `ออเดอร์ ${orderId} — ${order.totalAmount.toLocaleString()}฿`,
          url: `/my/orders/${orderId}`,
        }).catch(() => {});
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
      if (order.customer?.id) {
        sendCustomerPush(order.customer.id, {
          title: "สลิปไม่ผ่าน",
          body: `กรุณาส่งสลิปการชำระใหม่สำหรับออเดอร์ ${orderId}`,
          url: `/my/orders/${orderId}`,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update payment:", error);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}
