import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage, pushTextWithImages } from "@/lib/line-api";
import { formatDate, formatDateTime } from "@/lib/timezone";
import { parseDeliveryPhotos } from "@/lib/delivery-photos";
import { sendCustomerPush } from "@/lib/push";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const limitParam = searchParams.get("limit");

    const where: Record<string, unknown> = {
      status: { in: ["พร้อมส่ง", "กำลังจัดส่ง", "ส่งแล้ว"] },
    };
    const days = daysParam ? parseInt(daysParam, 10) : 30;
    if (!isNaN(days) && days > 0) {
      const from = new Date();
      from.setDate(from.getDate() - days);
      where.orderDate = { gte: from };
    }
    const take = limitParam
      ? Math.min(parseInt(limitParam, 10) || 200, 1000)
      : 200;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        orderId: true,
        status: true,
        totalAmount: true,
        orderDate: true,
        walkInName: true,
        requestedDeliveryDate: true,
        deliveryMethod: true,
        customer: { select: { name: true, phone: true, address: true } },
        delivery: { select: { id: true, address: true, photoUrl: true } },
        items: { select: { itemName: true, quantity: true, price: true } },
      },
    });

    const deliveries = orders.map((o) => ({
      orderId: o.orderId,
      orderDbId: o.id,
      customer: o.customer?.name || o.walkInName || "",
      phone: o.customer?.phone || "",
      address: o.delivery?.address || o.customer?.address || "",
      status: o.status,
      date: formatDate(o.orderDate),
      // The customer's booked appointment (when they want it delivered/picked
      // up) so the driver can plan the route by time. null = no booking.
      requestedAt: o.requestedDeliveryDate ? formatDateTime(o.requestedDeliveryDate) : null,
      deliveryMethod: o.deliveryMethod || null,
      items: o.items.map((i) => ({
        name: i.itemName,
        qty: i.quantity,
        price: i.price,
      })),
      totalAmount: o.totalAmount,
      photoUrl: o.delivery?.photoUrl || null,
      deliveryId: o.delivery?.id || null,
    }));

    return NextResponse.json(deliveries);
  } catch (error) {
    console.error("Failed to fetch deliveries:", error);
    return NextResponse.json(
      { error: "Failed to fetch deliveries" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status, photoUrl } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "orderId and status are required" },
        { status: 400 }
      );
    }

    // Find the order
    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { customer: true, delivery: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update order status
    await prisma.order.update({
      where: { orderId },
      data: { status },
    });

    // Upsert delivery record
    await prisma.delivery.upsert({
      where: { orderId: order.id },
      update: {
        status:
          status === "กำลังจัดส่ง"
            ? "กำลังจัดส่ง"
            : status === "ส่งแล้ว"
              ? "ส่งแล้ว"
              : "รอจัดส่ง",
        photoUrl: photoUrl || undefined,
        date: status === "ส่งแล้ว" ? new Date() : undefined,
      },
      create: {
        orderId: order.id,
        address: order.customer?.address,
        status:
          status === "กำลังจัดส่ง"
            ? "กำลังจัดส่ง"
            : status === "ส่งแล้ว"
              ? "ส่งแล้ว"
              : "รอจัดส่ง",
        photoUrl: photoUrl || null,
        date: status === "ส่งแล้ว" ? new Date() : null,
      },
    });

    // Send LINE notification based on status change
    if (order.customer?.lineUserId) {
      if (status === "กำลังจัดส่ง") {
        const message = `🚚 กำลังจัดส่งครับ!\n\nออเดอร์: ${orderId}\nกำลังเดินทางไปส่งที่ ${order.customer?.address || "ที่อยู่ลูกค้า"}\n\nรอสักครู่นะครับ 😊`;
        pushTextMessage(order.customer.lineUserId, message).catch((err) =>
          console.error("Failed to send LINE delivery notification:", err)
        );
        sendCustomerPush(order.customer.id, {
          title: "กำลังจัดส่ง",
          body: `ออเดอร์ ${orderId} กำลังเดินทางไปส่ง`,
          url: `/my/orders/${orderId}`,
        }).catch(() => {});
      }

      if (status === "ส่งแล้ว") {
        const message = `✅ จัดส่งเรียบร้อยครับ!\n\nออเดอร์: ${orderId}\nส่งถึงแล้วนะครับ ขอบคุณที่ใช้บริการ 🙏`;
        const httpsUrls = parseDeliveryPhotos(photoUrl).filter((u) => u.startsWith("http"));
        if (httpsUrls.length > 0) {
          pushTextWithImages(
            order.customer.lineUserId,
            message,
            httpsUrls
          ).catch((err) =>
            console.error("Failed to send LINE delivered notification:", err)
          );
        } else {
          pushTextMessage(order.customer.lineUserId, message).catch((err) =>
            console.error("Failed to send LINE delivered notification:", err)
          );
        }
        sendCustomerPush(order.customer.id, {
          title: "จัดส่งเรียบร้อย!",
          body: `ออเดอร์ ${orderId} ส่งถึงแล้ว ขอบคุณที่ใช้บริการ 🙏`,
          url: `/my/orders/${orderId}`,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update delivery:", error);
    return NextResponse.json(
      { error: "Failed to update delivery" },
      { status: 500 }
    );
  }
}
