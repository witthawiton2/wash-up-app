import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushTextMessage } from "@/lib/line-api";
import { notifyAdminNewBooking, notifyAdminLine } from "@/lib/notify-admin";

// Strip any existing "จองคิว: ..." segment from a note so re-bookings or
// cancellations don't leave stale booking text behind that the bookings
// page would later misread.
const BOOKING_SEGMENT_RE = /(?:^|\s\|\s)จองคิว:[^|]*(?=\s\||$)/g;

function stripBookingFromNote(note: string | null): string {
  if (!note) return "";
  return note.replace(BOOKING_SEGMENT_RE, "").trim().replace(/^\|\s*/, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, activity, orderId, date, time, phone, note, deliveryMethod } = body;

    if (!lineUserId || !activity || !date || !time) {
      return NextResponse.json(
        { error: "lineUserId, activity, date, and time are required" },
        { status: 400 }
      );
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
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
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

    if (targetOrder) {
      // Drop any prior "จองคิว: ..." segment so a re-booking replaces the old
      // booking info instead of stacking on top of it.
      const baseNote = stripBookingFromNote(targetOrder.note);
      await prisma.order.update({
        where: { id: targetOrder.id },
        data: {
          requestedDeliveryDate: new Date(`${date}T${time}:00+07:00`),
          note: baseNote ? `${baseNote} | ${bookingInfo}` : bookingInfo,
        },
      });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to create booking:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lineUserId = searchParams.get("lineUserId");
    const orderId = searchParams.get("orderId");

    if (!lineUserId || !orderId) {
      return NextResponse.json(
        { error: "lineUserId and orderId are required" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({ where: { lineUserId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const order = await prisma.order.findFirst({
      where: { orderId, customerId: customer.id },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (!order.requestedDeliveryDate) {
      return NextResponse.json({ error: "No booking to cancel" }, { status: 400 });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
