import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SLOT_TIMES,
  SLOT_METHODS,
  type SlotMethod,
  bangkokDayRange,
  extractMethodFromNote,
  formatSlotTimeFromDate,
} from "@/lib/booking-slots";
import { apiError, getRequestLang } from "@/lib/api-i18n";

// Response shape:
//   { "9:00": { home: { used, cap, full }, self: { used, cap, full } }, ... }
// cap is null when the admin hasn't set a cap for that (time, method).
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
      prisma.bookingSlotCap.findMany({
        select: { time: true, method: true, capacity: true },
      }),
    ]);

    // Count bookings by (time, method).
    const used = new Map<string, Map<SlotMethod, number>>();
    for (const o of orders) {
      if (!o.requestedDeliveryDate) continue;
      const time = formatSlotTimeFromDate(o.requestedDeliveryDate);
      const method = extractMethodFromNote(o.note);
      if (!method) continue;
      if (!used.has(time)) used.set(time, new Map());
      const m = used.get(time)!;
      m.set(method, (m.get(method) ?? 0) + 1);
    }

    const capMap = new Map<string, Map<SlotMethod, number>>();
    for (const c of caps) {
      const method = c.method as SlotMethod;
      if (!SLOT_METHODS.includes(method)) continue;
      if (!capMap.has(c.time)) capMap.set(c.time, new Map());
      capMap.get(c.time)!.set(method, c.capacity);
    }

    const out: Record<string, Record<SlotMethod, { used: number; cap: number | null; full: boolean }>> = {};
    for (const time of SLOT_TIMES) {
      out[time] = { home: { used: 0, cap: null, full: false }, self: { used: 0, cap: null, full: false } };
      for (const method of SLOT_METHODS) {
        const u = used.get(time)?.get(method) ?? 0;
        const capVal = capMap.get(time)?.get(method);
        const cap = capVal === undefined ? null : capVal;
        out[time][method] = {
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
