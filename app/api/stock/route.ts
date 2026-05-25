import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CATEGORIES = new Set(["detergent", "hangers", "packaging", "other"]);

export async function GET() {
  try {
    const items = await prisma.stock.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, name, unit, quantity, reorderLevel, note } = body;

    if (!name || !category) {
      return NextResponse.json({ error: "name and category are required" }, { status: 400 });
    }
    const safeCategory = CATEGORIES.has(category) ? category : "other";

    const item = await prisma.stock.create({
      data: {
        category: safeCategory,
        name: name.trim(),
        unit: unit?.trim() || "piece",
        quantity: Number(quantity) || 0,
        reorderLevel: Number(reorderLevel) || 0,
        note: note?.trim() || null,
      },
    });
    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to create stock item:", error);
    return NextResponse.json({ error: "Failed to create stock item" }, { status: 500 });
  }
}
