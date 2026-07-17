import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SLOT_TIMES,
  SLOT_ACTIVITIES,
  type SlotActivity,
  bangkokDayRange,
  extractActivityFromNote,
  formatSlotTimeFromDate,
} from "@/lib/booking-slots";
import { apiError, getRequestLang } from "@/lib/api-i18n";

// Response shape:
//   { "9:00": { send: { used, cap, full }, receive: { used, cap, full } }, ... }
// cap is null when the admin hasn't set a cap for that (time, activity).
// full is `used >= cap` when cap != null, else false.

export async function GET(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const date = request.nextUrl.searchParams.get("date");
    if (!date) return apiError(lang, "missing_fields", 400);

    const range = bangkokDayRange(date);
    const [orders, caps] = await Promise.all([
      prisma.order.findMany({
        where: { requestedDeliveryDate: { gte: range.gte, lte: range.lte } },
        select: { requestedDeliveryDate: true, note: true },
      }),
      // Default caps (date "") plus any overrides for this specific date.
      prisma.bookingSlotCap.findMany({
        where: { date: { in: ["", date] } },
        select: { date: true, time: true, activity: true, capacity: true },
      }),
    ]);

    // Count bookings by (time, activity), reading the activity back from the
    // booking segment stored in each order's note.
    const used = new Map<string, Map<SlotActivity, number>>();
    for (const o of orders) {
      if (!o.requestedDeliveryDate) continue;
      const time = formatSlotTimeFromDate(o.requestedDeliveryDate);
      const activity = extractActivityFromNote(o.note);
      if (!activity) continue;
      if (!used.has(time)) used.set(time, new Map());
      const m = used.get(time)!;
      m.set(activity, (m.get(activity) ?? 0) + 1);
    }

    // Resolve caps: an override row (non-empty date) wins over the default ("").
    const capMap = new Map<string, Map<SlotActivity, number>>();
    for (const c of caps) {
      const activity = c.activity as SlotActivity;
      if (!SLOT_ACTIVITIES.includes(activity)) continue;
      if (!capMap.has(c.time)) capMap.set(c.time, new Map());
      const row = capMap.get(c.time)!;
      if (c.date === date || !row.has(activity)) row.set(activity, c.capacity);
    }

    const out: Record<string, Record<SlotActivity, { used: number; cap: number | null; full: boolean }>> = {};
    for (const time of SLOT_TIMES) {
      out[time] = { send: { used: 0, cap: null, full: false }, receive: { used: 0, cap: null, full: false } };
      for (const activity of SLOT_ACTIVITIES) {
        const u = used.get(time)?.get(activity) ?? 0;
        const capVal = capMap.get(time)?.get(activity);
        const cap = capVal === undefined ? null : capVal;
        out[time][activity] = {
          used: u,
          cap,
          full: cap !== null && u >= cap,
        };
      }
    }

    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to compute slot availability:", error);
    return apiError(lang, "generic_error", 500);
  }
}
