import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/timezone";
import { extractActivityFromNote } from "@/lib/booking-slots";
import { pushTextMessage } from "@/lib/line-api";
import { sendCustomerPush } from "@/lib/push";

// Short activity labels for the admin bookings badge.
const ACTIVITY_SHORT: Record<string, string> = {
  send: "ส่งเสื้อผ้าซัก",
  receive: "รับเสื้อผ้าคืน",
};

// note format from POST /api/my/booking:
//   "จองคิว: <activity> [(orderId)] วันที่ YYYY-MM-DD เวลา HH:MM[ โทร: ...][ หมายเหตุ: ...]"
const NOTE_DATE_RE = /วันที่\s+(\d{4}-\d{2}-\d{2})\s+เวลา\s+(\d{1,2}:\d{2})/;
const NOTE_METHOD_RE = /\sวิธี:\s+([^|]+?)(?=\s+(?:โทร:|หมายเหตุ:)|\s+\||$)/;
const BOOKING_SEGMENT_RE = /(?:^|\s\|\s)จองคิว:[^|]*(?=\s\||$)/g;

function reformatNoteDate(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY (Buddhist year) to match formatDate output
  const [y, m, d] = iso.split("-");
  const buddhist = parseInt(y, 10) + 543;
  return `${d}/${m}/${buddhist}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get("days");
    const limitParam = searchParams.get("limit");

    const where: Record<string, unknown> = {
      requestedDeliveryDate: { not: null },
    };
    const days = daysParam ? parseInt(daysParam, 10) : 60;
    if (!isNaN(days) && days > 0) {
      // Window: include past 14d (history) and the next N days (upcoming).
      const from = new Date();
      from.setDate(from.getDate() - 14);
      const to = new Date();
      to.setDate(to.getDate() + days);
      where.requestedDeliveryDate = { gte: from, lte: to };
    }
    const take = limitParam
      ? Math.min(parseInt(limitParam, 10) || 500, 2000)
      : 500;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { requestedDeliveryDate: "asc" },
      take,
      select: {
        orderId: true,
        status: true,
        note: true,
        orderDate: true,
        requestedDeliveryDate: true,
        walkInName: true,
        customer: {
          select: { name: true, phone: true, address: true, customerCode: true },
        },
        items: { select: { itemName: true, quantity: true } },
      },
    });

    const bookings = orders.map((o) => {
      const note = o.note || "";
      const match = note.match(NOTE_DATE_RE);
      const methodMatch = note.match(NOTE_METHOD_RE);

      // Prefer the time captured in the note (always Bangkok wall-clock and
      // immune to the legacy timezone bug). Fall back to requestedDeliveryDate.
      const requestedDate = match ? reformatNoteDate(match[1]) : formatDate(o.requestedDeliveryDate!);
      const requestedTime = match ? match[2] : formatTime(o.requestedDeliveryDate!);
      const deliveryMethod = methodMatch ? methodMatch[1].trim() : "";
      const activityKey = extractActivityFromNote(note);
      const activity = activityKey ? ACTIVITY_SHORT[activityKey] : "";

      // Strip the duplicated "จองคิว: ..." segment from the note for display.
      const cleanedNote = note.replace(BOOKING_SEGMENT_RE, "").trim().replace(/^\|\s*/, "");

      return {
        orderId: o.orderId,
        customer: o.customer
          ? `${o.customer.customerCode ? o.customer.customerCode + " " : ""}${o.customer.name}`
          : o.walkInName || "",
        phone: o.customer?.phone || "",
        address: o.customer?.address || "",
        items: o.items.map((i) => ({ name: i.itemName, qty: i.quantity })),
        status: o.status,
        requestedDate,
        requestedTime,
        activity,
        deliveryMethod,
        note: cleanedNote,
        orderDate: formatDate(o.orderDate),
      };
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error("Failed to fetch bookings:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}

// Admin cancels a customer's booking: clear the requested slot and strip the
// "จองคิว: ..." segment from the note, leaving the rest of the order intact.
// (Middleware gates this to the admin role.)
export async function DELETE(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { orderId },
      include: { customer: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.requestedDeliveryDate) {
      return NextResponse.json({ error: "No booking to cancel" }, { status: 400 });
    }

    const cleanedNote = (order.note || "")
      .replace(BOOKING_SEGMENT_RE, "")
      .trim()
      .replace(/^\|\s*/, "");

    await prisma.order.update({
      where: { orderId },
      data: {
        requestedDeliveryDate: null,
        note: cleanedNote || null,
      },
    });

    // Let the customer know the shop cancelled their queue (best-effort).
    if (order.customer?.lineUserId) {
      pushTextMessage(
        order.customer.lineUserId,
        `❌ ทางร้านได้ยกเลิกคิวของคุณ\n\nออเดอร์: ${orderId}\nหากต้องการจองใหม่ เข้าไปจองได้ที่หน้า "จองคิว" ครับ 🙏`
      ).catch((err) => console.error("Failed to send LINE admin-cancel notice:", err));
      sendCustomerPush(order.customer.id, {
        title: "คิวถูกยกเลิก",
        body: `ออเดอร์ ${orderId} — จองใหม่ได้ที่หน้าจองคิว`,
        url: "/my?tab=booking",
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
