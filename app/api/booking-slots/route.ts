import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SLOT_ACTIVITIES, type SlotActivity } from "@/lib/booking-slots";

// Caps live at two levels:
//   date = ""           → default, applies to every day
//   date = "YYYY-MM-DD"  → override for that specific date (holidays/peak days)
// The editor loads/saves one level at a time via the ?date= param (blank = default).
// Each cap is dimensioned by booking activity ("send" | "receive").

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") ?? "";
    const rows = await prisma.bookingSlotCap.findMany({
      where: { date },
      select: { time: true, activity: true, capacity: true },
    });
    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch booking slot caps:", msg);
    return NextResponse.json(
      { error: "Failed to fetch booking slot caps", detail: msg },
      { status: 500 }
    );
  }
}

interface CapInput { time: string; activity: string; capacity: number | null }

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    const items: CapInput[] = Array.isArray(body?.items) ? body.items : [];

    // Split into deletes (capacity === null → "unlimited"/inherit) and upserts.
    const deletes: { time: string; activity: string }[] = [];
    const upserts: { time: string; activity: string; capacity: number }[] = [];
    for (const it of items) {
      if (typeof it?.time !== "string" || !it.time.trim()) continue;
      if (!SLOT_ACTIVITIES.includes(it.activity as SlotActivity)) continue;
      const time = it.time.trim();
      const activity = it.activity;
      if (it.capacity === null || it.capacity === undefined) {
        deletes.push({ time, activity });
      } else {
        const cap = Number(it.capacity);
        if (!Number.isFinite(cap) || cap < 0) continue;
        upserts.push({ time, activity, capacity: Math.floor(cap) });
      }
    }

    await prisma.$transaction([
      ...deletes.map((d) =>
        prisma.bookingSlotCap.deleteMany({
          where: { date, time: d.time, activity: d.activity },
        })
      ),
      ...upserts.map((u) =>
        prisma.bookingSlotCap.upsert({
          where: { date_time_activity: { date, time: u.time, activity: u.activity } },
          create: { date, ...u },
          update: { capacity: u.capacity },
        })
      ),
    ]);

    const rows = await prisma.bookingSlotCap.findMany({
      where: { date },
      select: { time: true, activity: true, capacity: true },
    });
    return NextResponse.json(rows);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to update booking slot caps:", msg);
    return NextResponse.json(
      { error: "Failed to update booking slot caps", detail: msg },
      { status: 500 }
    );
  }
}
