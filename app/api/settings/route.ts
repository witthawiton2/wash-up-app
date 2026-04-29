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
    const {
      logoUrl,
      companyName,
      companyPhone,
      companyAddress,
      lineId,
      promptpayId,
      receiptHeader,
      receiptFooter,
    } = body;

    const data = {
      logoUrl: logoUrl ?? null,
      companyName: companyName ?? null,
      companyPhone: companyPhone ?? null,
      companyAddress: companyAddress ?? null,
      lineId: lineId ?? null,
      promptpayId: promptpayId ?? null,
      receiptHeader: receiptHeader ?? null,
      receiptFooter: receiptFooter ?? null,
    };

    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
