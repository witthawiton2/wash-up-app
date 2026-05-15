import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime } from "@/lib/timezone";

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

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: { requestedDeliveryDate: { not: null } },
      include: { customer: true, items: true },
      orderBy: { requestedDeliveryDate: "asc" },
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
