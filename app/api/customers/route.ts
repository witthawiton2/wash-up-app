import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });

    const formatted = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      package: c.package || "Basic",
      endDate: c.endDate
        ? c.endDate.toLocaleDateString("th-TH", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "",
      remaining: c.remaining,
      lineUserId: c.lineUserId || "",
      customerCode: c.customerCode || "",
      status: c.status || "approved",
      renewPending: c.renewPending || false,
      renewSlipUrl: c.renewSlipUrl || "",
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, address, package: pkg, endDate, remaining, lineUserId, customerCode } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        customerCode: customerCode || null,
        phone: phone || null,
        address: address || null,
        package: pkg || "Basic",
        endDate: endDate ? parseThaiDate(endDate) : null,
        remaining: remaining || 0,
        lineUserId: lineUserId || null,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to create customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, phone, address, package: pkg, endDate, remaining, lineUserId, customerCode } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        customerCode: customerCode !== undefined ? (customerCode || null) : undefined,
        phone: phone || null,
        address: address || null,
        package: pkg || "Basic",
        endDate: endDate ? parseThaiDate(endDate) : null,
        remaining: remaining || 0,
        lineUserId: lineUserId || null,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to update customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.customer.delete({ where: { id: Number(id) } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}

function parseThaiDate(dateStr: string): Date | null {
  // Expected format: DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}
