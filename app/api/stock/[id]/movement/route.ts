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
    // total always agrees with the sum of movements.
    const [, item] = await prisma.$transaction([
      prisma.stockMovement.create({ data: { stockId, delta, note } }),
      prisma.stock.update({
        where: { id: stockId },
        data: { quantity: { increment: delta } },
      }),
    ]);
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to record stock movement:", error);
    return NextResponse.json({ error: "Failed to record stock movement" }, { status: 500 });
  }
}
