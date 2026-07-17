import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const stockId = Number(id);
    const body = await request.json();
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: "delta required and non-zero" }, { status: 400 });
    }
    const note = typeof body.note === "string" ? body.note.trim() || null : null;

    // Bookkeeping movement + quantity adjust in a transaction so the running
    // total always agrees with the sum of movements. Reject moves that would
    // drive the quantity below 0 rather than allowing negative stock.
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.stock.findUnique({
        where: { id: stockId },
        select: { quantity: true },
      });
      if (!current) return { notFound: true as const };
      if (current.quantity + delta < 0) {
        return { insufficient: true as const, available: current.quantity };
      }
      await tx.stockMovement.create({ data: { stockId, delta, note } });
      const item = await tx.stock.update({
        where: { id: stockId },
        data: { quantity: { increment: delta } },
      });
      return { item };
    });

    if ("notFound" in result) {
      return NextResponse.json({ error: "Stock item not found" }, { status: 404 });
    }
    if ("insufficient" in result) {
      return NextResponse.json(
        { error: `สต็อกไม่พอ (คงเหลือ ${result.available})`, available: result.available },
        { status: 400 }
      );
    }
    return NextResponse.json(result.item);
  } catch (error) {
    console.error("Failed to record stock movement:", error);
    return NextResponse.json({ error: "Failed to record stock movement" }, { status: 500 });
  }
}
