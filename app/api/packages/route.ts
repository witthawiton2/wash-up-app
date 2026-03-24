import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
    });
    return NextResponse.json(packages);
  } catch (error) {
    console.error("Failed to fetch packages:", error);
    return NextResponse.json(
      { error: "Failed to fetch packages" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, totalItems, validDays, price } = body;

    if (!name || !totalItems || !validDays || price === undefined) {
      return NextResponse.json(
        { error: "name, totalItems, validDays, and price are required" },
        { status: 400 }
      );
    }

    const pkg = await prisma.package.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        totalItems,
        validDays,
        price,
      },
    });

    return NextResponse.json(pkg);
  } catch (error) {
    console.error("Failed to create package:", error);
    return NextResponse.json(
      { error: "Failed to create package" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, description, totalItems, validDays, price, active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    const pkg = await prisma.package.update({
      where: { id },
      data: {
        name: name?.trim(),
        description: description?.trim() || null,
        totalItems,
        validDays,
        price,
        active,
      },
    });

    return NextResponse.json(pkg);
  } catch (error) {
    console.error("Failed to update package:", error);
    return NextResponse.json(
      { error: "Failed to update package" },
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

    await prisma.package.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete package:", error);
    return NextResponse.json(
      { error: "Failed to delete package" },
      { status: 500 }
    );
  }
}
