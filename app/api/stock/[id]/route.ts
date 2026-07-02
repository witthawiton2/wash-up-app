import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CATEGORIES = new Set(["detergent", "hangers", "packaging", "other"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name.trim();
    if (typeof body.unit === "string") data.unit = body.unit.trim();
    if (typeof body.category === "string") {
      data.category = CATEGORIES.has(body.category) ? body.category : "other";
    }
    if (body.reorderLevel !== undefined) data.reorderLevel = Number(body.reorderLevel) || 0;
    if (body.note !== undefined) data.note = body.note?.trim() || null;

    const item = await prisma.stock.update({ where: { id: itemId }, data });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update stock item:", error);
    return NextResponse.json({ error: "Failed to update stock item" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const numId = Number(id);
    const existing = await prisma.stock.findUnique({ where: { id: numId } });
    if (!existing) {
      return NextResponse.json({ success: true, alreadyGone: true });
    }
    await prisma.stock.update({ where: { id: numId }, data: { active: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete stock item:", msg);
    return NextResponse.json({ error: "Failed to delete stock item", detail: msg }, { status: 500 });
  }
}
