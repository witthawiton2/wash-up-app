import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage, pushTextWithImages } from "@/lib/line-api";
import { getBaseUrl } from "@/lib/base-url";

export async function GET() {
  try {
    // Fetch orders that are in delivery-related statuses
    const orders = await prisma.order.findMany({
      where: {
        status: { in: ["พร้อมส่ง", "กำลังจัดส่ง", "ส่งแล้ว"] },
      },
      include: {
        customer: true,
        delivery: true,
        items: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    const deliveries = orders.map((o) => ({
      orderId: o.orderId,
      orderDbId: o.id,
      customer: o.customer?.name || o.walkInName || "",
      phone: o.customer?.phone || "",
      address: o.delivery?.address || o.customer?.address || "",
      status: o.status,
      date: o.orderDate.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
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
      const baseUrl = getBaseUrl();

      if (status === "กำลังจัดส่ง") {
        const message = `🚚 กำลังจัดส่งครับ!\n\nออเดอร์: ${orderId}\nกำลังเดินทางไปส่งที่ ${order.customer?.address || "ที่อยู่ลูกค้า"}\n\nรอสักครู่นะครับ 😊`;
        pushTextMessage(order.customer.lineUserId, message).catch((err) =>
          console.error("Failed to send LINE delivery notification:", err)
        );
      }

      if (status === "ส่งแล้ว") {
        const message = `✅ จัดส่งเรียบร้อยครับ!\n\nออเดอร์: ${orderId}\nส่งถึงแล้วนะครับ ขอบคุณที่ใช้บริการ 🙏`;
        // Parse photoUrl — could be JSON array or single URL
        let imageUrls: string[] = [];
        if (photoUrl) {
          try {
            const parsed = JSON.parse(photoUrl);
            imageUrls = Array.isArray(parsed) ? parsed : [photoUrl];
          } catch {
            imageUrls = [photoUrl];
          }
        }
        const httpsUrls = imageUrls.filter((u) => u.startsWith("http"));
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
