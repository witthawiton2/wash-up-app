import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.serviceItem.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch service items:", error);
    return NextResponse.json(
      { error: "Failed to fetch service items" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, price, category, note, inPackage, packageDeduction } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const item = await prisma.serviceItem.create({
      data: {
        name: name.trim(),
        price: price || 0,
        category: category || "รายการซักอบรีด",
        note: note || null,
        inPackage: inPackage ?? false,
        packageDeduction: packageDeduction || 1,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to create service item:", error);
    return NextResponse.json(
      { error: "Failed to create service item" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, price, category, note, inPackage, packageDeduction, active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    const item = await prisma.serviceItem.update({
      where: { id },
      data: {
        name: name?.trim(),
        price,
        category,
        note: note !== undefined ? (note || null) : undefined,
        inPackage,
        packageDeduction,
        active,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to update service item:", error);
    return NextResponse.json(
      { error: "Failed to update service item" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    await prisma.serviceItem.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete service item:", error);
    return NextResponse.json(
      { error: "Failed to delete service item" },
      { status: 500 }
    );
  }
}
