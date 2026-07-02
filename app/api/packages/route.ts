import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const packages = await prisma.package.findMany({
      where: { active: true },
      orderBy: { price: "asc" },
    });
    // Package list rarely changes — cache for a minute with SWR.
    return NextResponse.json(packages, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
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

    // Only `name` is truly required; per-piece packages leave totalItems
    // and/or validDays at 0.
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const trimmedName = name.trim();
    const items = Number(totalItems) || 0;
    const days = Number(validDays) || 0;
    const priceNum = Number(price) || 0;

    // If a row with this name already exists (possibly soft-deleted via
    // DELETE), revive/update it instead of hitting the unique constraint.
    const existing = await prisma.package.findUnique({ where: { name: trimmedName } });
    if (existing) {
      if (existing.active) {
        return NextResponse.json(
          { error: "Package with this name already exists" },
          { status: 409 }
        );
      }
      const revived = await prisma.package.update({
        where: { id: existing.id },
        data: {
          description: description?.trim() || null,
          totalItems: items,
          validDays: days,
          price: priceNum,
          active: true,
        },
      });
      return NextResponse.json(revived);
    }

    const pkg = await prisma.package.create({
      data: {
        name: trimmedName,
        description: description?.trim() || null,
        totalItems: items,
        validDays: days,
        price: priceNum,
      },
    });

    return NextResponse.json(pkg);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to create package:", msg);
    return NextResponse.json(
      { error: "Failed to create package", detail: msg },
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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to update package:", msg);
    return NextResponse.json(
      { error: "Failed to update package", detail: msg },
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

    const pkg = await prisma.package.findUnique({ where: { id: Number(id) } });
    if (!pkg) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    // Customer.package holds the package NAME (plain string, not a FK).
    // If any customer still points at this package we soft-delete instead
    // so historical data keeps rendering.
    const inUse = await prisma.customer.count({ where: { package: pkg.name } });
    if (inUse > 0) {
      const disabled = await prisma.package.update({
        where: { id: pkg.id },
        data: { active: false },
      });
      return NextResponse.json({ success: true, softDeleted: true, inUse, pkg: disabled });
    }

    await prisma.package.delete({ where: { id: pkg.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete package:", msg);
    return NextResponse.json(
      { error: "Failed to delete package", detail: msg },
      { status: 500 }
    );
  }
}
