import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage } from "@/lib/line-api";
import { notifyAdminNewBooking, notifyAdminLine } from "@/lib/notify-admin";
import { apiError, getRequestLang } from "@/lib/api-i18n";
import { sendCustomerPush } from "@/lib/push";

// Strip any existing "จองคิว: ..." segment from a note so re-bookings or
// cancellations don't leave stale booking text behind that the bookings
// page would later misread.
const BOOKING_SEGMENT_RE = /(?:^|\s\|\s)จองคิว:[^|]*(?=\s\||$)/g;

function stripBookingFromNote(note: string | null): string {
  if (!note) return "";
  return note.replace(BOOKING_SEGMENT_RE, "").trim().replace(/^\|\s*/, "");
}

export async function POST(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const body = await request.json();
    const { lineUserId, activity, orderId, date, time, phone, note, deliveryMethod } = body;

    if (!lineUserId || !activity || !date || !time) {
      return apiError(lang, "missing_fields", 400);
    }

    const methodLabels: Record<string, string> = {
      self: "รับด้วยตัวเอง",
      home: "ฝากที่พัก",
    };
    const methodLabel = deliveryMethod ? methodLabels[deliveryMethod] || deliveryMethod : "";

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
    });
    if (!customer) {
      return apiError(lang, "customer_not_found", 404);
    }

    const activityLabels: Record<string, string> = {
      send: "ส่งเสื้อผ้าซัก",
      receive: "รับเสื้อผ้าที่เสร็จคืน (+ส่งเสื้อผ้าใหม่)",
    };

    // Save booking as a note on the latest pending order, or create a standalone record
    const latestOrder = await prisma.order.findFirst({
      where: { customerId: customer.id, status: { not: "ส่งแล้ว" } },
      orderBy: { createdAt: "desc" },
    });

    const bookingInfo = `จองคิว: ${activityLabels[activity] || activity}${orderId ? ` (${orderId})` : ""} วันที่ ${date} เวลา ${time}${methodLabel ? ` วิธี: ${methodLabel}` : ""}${phone ? ` โทร: ${phone}` : ""}${note ? ` หมายเหตุ: ${note}` : ""}`;

    // If orderId specified, update that order; otherwise use latest pending order
    const targetOrder = orderId
      ? await prisma.order.findFirst({ where: { orderId, customerId: customer.id } })
      : latestOrder;

    // The customer-facing time slots use "9:00" / "9:30" — pad to 2 digits
    // so the ISO string is valid for new Date().
    const [hh, mm] = time.split(":");
    const isoTime = `${(hh || "0").padStart(2, "0")}:${(mm || "00").padStart(2, "0")}`;
    const requestedDeliveryDate = new Date(`${date}T${isoTime}:00+07:00`);

    if (targetOrder) {
      // Drop any prior "จองคิว: ..." segment so a re-booking replaces the old
      // booking info instead of stacking on top of it.
      const baseNote = stripBookingFromNote(targetOrder.note);
      await prisma.order.update({
        where: { id: targetOrder.id },
        data: {
          requestedDeliveryDate,
          note: baseNote ? `${baseNote} | ${bookingInfo}` : bookingInfo,
        },
      });
    } else {
      // Customer has no pending order in the system yet (e.g. old laundry
      // the shop is holding from before the software existed, or a fresh
      // drop-off not yet logged). Create an empty placeholder Order so the
      // booking shows up in /my "Your bookings" and /dashboard/bookings —
      // shop will fill in the items when they process the physical laundry.
      // Retry a couple of times on the rare orderId race with staff creates.
      for (let attempt = 0; attempt < 5; attempt++) {
        const latest = await prisma.order.findFirst({
          orderBy: { id: "desc" },
          select: { orderId: true },
        });
        const nextNum = latest ? (parseInt(latest.orderId.replace(/\D/g, ""), 10) || 0) + 1 : 1;
        const newOrderId = String(nextNum + attempt).padStart(6, "0");
        try {
          await prisma.order.create({
            data: {
              orderId: newOrderId,
              customerId: customer.id,
              status: "รอซักรีด",
              totalAmount: 0,
              requestedDeliveryDate,
              note: bookingInfo,
            },
          });
          break;
        } catch (e) {
          // Unique-constraint collision — try the next number.
          if (attempt === 4) throw e;
        }
      }
    }

    // Notify admin via LINE
    const adminActivity = methodLabel
      ? `${activityLabels[activity] || activity} (${methodLabel})`
      : activityLabels[activity] || activity;
    notifyAdminNewBooking(customer.name, adminActivity, date, time, orderId).catch(() => {});

    // Send LINE notification to customer
    if (customer.lineUserId) {
      pushTextMessage(
        customer.lineUserId,
        `📅 จองคิวสำเร็จ!\n\n${activityLabels[activity] || activity}${orderId ? `\nออเดอร์: ${orderId}` : ""}\nวันที่: ${date}\nเวลา: ${time}${methodLabel ? `\nวิธี: ${methodLabel}` : ""}\n\nรอการยืนยันจากร้านครับ 😊`
      ).catch((err) => console.error("Failed to send booking LINE:", err));
    }
    sendCustomerPush(customer.id, {
      title: "จองคิวสำเร็จ!",
      body: `${activityLabels[activity] || activity} ${date} ${time}`,
      url: "/my?tab=booking",
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to create booking:", error);
    return apiError(lang, "booking_failed", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const orderId = searchParams.get("orderId");

    if (!lineUserId || !orderId) {
      return apiError(lang, "missing_fields", 400);
    }

    const customer = await prisma.customer.findUnique({ where: { lineUserId } });
    if (!customer) {
      return apiError(lang, "customer_not_found", 404);
    }

    const order = await prisma.order.findFirst({
      where: { orderId, customerId: customer.id },
    });
    if (!order) {
      return apiError(lang, "order_not_found", 404);
    }
    if (!order.requestedDeliveryDate) {
      return apiError(lang, "cancel_failed", 400);
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        requestedDeliveryDate: null,
        note: stripBookingFromNote(order.note),
      },
    });

    // Notify admin
    notifyAdminLine(
      `❌ ลูกค้ายกเลิกคิว\n\nลูกค้า: ${customer.name}\nออเดอร์: ${orderId}`
    ).catch(() => {});

    // Acknowledge the cancellation to the customer on LINE
    pushTextMessage(
      customer.lineUserId!,
      `❌ ยกเลิกคิวเรียบร้อย\n\nออเดอร์: ${orderId}\nหากต้องการจองใหม่ เข้าไปจองได้ที่หน้า "จองคิว" ครับ 😊`
    ).catch(() => {});
    sendCustomerPush(customer.id, {
      title: "ยกเลิกคิวแล้ว",
      body: `ออเดอร์ ${orderId} — จองใหม่ได้ที่หน้าจองคิว`,
      url: "/my?tab=booking",
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    return apiError(lang, "cancel_failed", 500);
  }
}
