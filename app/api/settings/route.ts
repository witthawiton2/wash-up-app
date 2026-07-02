import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: 1 } });
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Partial update: only touch fields the caller actually sent. A
    // missing key means "leave the current value alone" — this avoids
    // wiping the logo / company info when the client sends a partial
    // form. Explicit empty string still clears (stored as null).
    const FIELDS = [
      "logoUrl",
      "companyName",
      "companyPhone",
      "companyAddress",
      "lineId",
      "promptpayId",
      "receiptHeader",
      "receiptFooter",
    ] as const;
    const update: Record<string, string | null> = {};
    for (const f of FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, f)) {
        const v = body[f];
        update[f] = typeof v === "string" && v !== "" ? v : null;
      }
    }

    // First-run: if no row exists yet, create with whatever was provided.
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...update },
      update,
    });

    return NextResponse.json(settings);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to update settings:", msg);
    return NextResponse.json(
      { error: "Failed to update settings", detail: msg },
      { status: 500 }
    );
  }
}
