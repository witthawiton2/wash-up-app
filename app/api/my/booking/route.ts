import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pushTextMessage } from "@/lib/line-api";
import { notifyAdminNewBooking, notifyAdminLine } from "@/lib/notify-admin";
import { apiError, getRequestLang } from "@/lib/api-i18n";
import { sendCustomerPush } from "@/lib/push";
import {
  bangkokDayRange,
  extractMethodFromNote,
  formatSlotTimeFromDate,
  type SlotMethod,
} from "@/lib/booking-slots";

// Strip any existing "จองคิว: ..." segment from a note so re-bookings or
// cancellations don't leave stale booking text behind that the bookings
// page would later misread.
const BOOKING_SEGMENT_RE = /(?:^|\s\|\s)จองคิว:[^|]*(?=\s\||$)/g;

function stripBookingFromNote(note: string | null): string {
  if (!note) return "";
  return note.replace(BOOKING_SEGMENT_RE, "").trim().replace(/^\|\s*/, "");
}

// The capacity for (date, time, method): a per-date override wins over the
// every-day default; no row at either level means unlimited (null).
async function resolveSlotCap(
  tx: Prisma.TransactionClient,
  date: string,
  time: string,
  method: SlotMethod
): Promise<number | null> {
  const rows = await tx.bookingSlotCap.findMany({
    where: { date: { in: ["", date] }, time, method },
    select: { date: true, capacity: true },
  });
  const override = rows.find((r) => r.date === date);
  if (override) return override.capacity;
  const def = rows.find((r) => r.date === "");
  return def ? def.capacity : null;
}

// How many bookings already occupy (date, time, method) on the given day,
// excluding the order currently being (re)booked so re-picking the same slot
// isn't counted against itself. Prefers the deliveryMethod column, falling
// back to the note for orders not yet backfilled.
async function countSlotUsage(
  tx: Prisma.TransactionClient,
  range: { gte: Date; lte: Date },
  time: string,
  method: SlotMethod,
  excludeOrderId?: string
): Promise<number> {
  const sameDay = await tx.order.findMany({
    where: {
      requestedDeliveryDate: { gte: range.gte, lte: range.lte },
      ...(excludeOrderId ? { NOT: { orderId: excludeOrderId } } : {}),
    },
    select: { requestedDeliveryDate: true, note: true, deliveryMethod: true },
  });
  return sameDay.filter((o) => {
    if (!o.requestedDeliveryDate) return false;
    if (formatSlotTimeFromDate(o.requestedDeliveryDate) !== time) return false;
    const m =
      o.deliveryMethod === "home" || o.deliveryMethod === "self"
        ? (o.deliveryMethod as SlotMethod)
        : extractMethodFromNote(o.note);
    return m === method;
  }).length;
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

    const bookingInfo = `จองคิว: ${activityLabels[activity] || activity}${orderId ? ` (${orderId})` : ""} วันที่ ${date} เวลา ${time}${methodLabel ? ` วิธี: ${methodLabel}` : ""}${phone ? ` โทร: ${phone}` : ""}${note ? ` หมายเหตุ: ${note}` : ""}`;

    // The customer-facing time slots use "9:00" / "9:30" — pad to 2 digits
    // so the ISO string is valid for new Date().
    const [hh, mm] = time.split(":");
    const isoTime = `${(hh || "0").padStart(2, "0")}:${(mm || "00").padStart(2, "0")}`;
    const requestedDeliveryDate = new Date(`${date}T${isoTime}:00+07:00`);

    const method: SlotMethod | null =
      deliveryMethod === "home" || deliveryMethod === "self" ? deliveryMethod : null;
    const range = bangkokDayRange(date);

    // Enforce the slot cap and persist the booking atomically so two customers
    // can't both grab the last slot. Serializable isolation makes the
    // concurrent count+write conflict; we retry a few times on that (P2034)
    // and on the rare orderId collision (P2002) when creating a placeholder.
    // Missing cap row = unlimited; capacity 0 = closed.
    let slotFull = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        slotFull = await prisma.$transaction(
          async (tx) => {
            if (method) {
              const cap = await resolveSlotCap(tx, date, time, method);
              if (cap !== null) {
                const used = await countSlotUsage(tx, range, time, method, orderId);
                if (used >= cap) return true; // slot full — reject
              }
            }

            // Attach the booking to the given order, else the latest pending
            // one, else create a placeholder (customer has nothing logged yet).
            const targetOrder = orderId
              ? await tx.order.findFirst({ where: { orderId, customerId: customer.id } })
              : await tx.order.findFirst({
                  where: { customerId: customer.id, status: { not: "ส่งแล้ว" } },
                  orderBy: { createdAt: "desc" },
                });

            if (targetOrder) {
              // Drop any prior "จองคิว: ..." segment so a re-booking replaces
              // the old booking info instead of stacking on top of it.
              const baseNote = stripBookingFromNote(targetOrder.note);
              await tx.order.update({
                where: { id: targetOrder.id },
                data: {
                  requestedDeliveryDate,
                  note: baseNote ? `${baseNote} | ${bookingInfo}` : bookingInfo,
                  ...(method ? { deliveryMethod: method } : {}),
                },
              });
            } else {
              const latest = await tx.order.findFirst({
                orderBy: { id: "desc" },
                select: { orderId: true },
              });
              const nextNum = latest ? (parseInt(latest.orderId.replace(/\D/g, ""), 10) || 0) + 1 : 1;
              const newOrderId = String(nextNum).padStart(6, "0");
              await tx.order.create({
                data: {
                  orderId: newOrderId,
                  customerId: customer.id,
                  status: "รอซักรีด",
                  totalAmount: 0,
                  requestedDeliveryDate,
                  deliveryMethod: method,
                  note: bookingInfo,
                },
              });
            }
            return false; // booked
          },
          { isolationLevel: "Serializable" }
        );
        break; // committed
      } catch (e) {
        const code =
          e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "";
        // P2034: serialization/deadlock; P2002: orderId collision — retry.
        if ((code === "P2034" || code === "P2002") && attempt < 4) continue;
        throw e;
      }
    }

    if (slotFull) {
      return apiError(lang, "slot_full", 409);
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
