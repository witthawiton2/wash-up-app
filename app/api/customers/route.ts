import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const limitParam = searchParams.get("limit");
    const phoneParam = searchParams.get("phone");

    const where: Record<string, unknown> = {};
    if (statusParam) where.status = statusParam;
    if (phoneParam && phoneParam.trim().length >= 3) {
      where.phone = { contains: phoneParam.trim() };
    }

    const take = phoneParam
      ? 20
      : limitParam
      ? Math.min(parseInt(limitParam, 10) || 500, 2000)
      : 500;

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        package: true,
        endDate: true,
        remaining: true,
        lineUserId: true,
        customerCode: true,
        status: true,
        renewPending: true,
        renewSlipUrl: true,
      },
    });

    const formatted = customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      address: c.address || "",
      package: c.package || "Basic",
      endDate: c.endDate ? formatDate(c.endDate) : "",
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

    const customerId = Number(id);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, customerCode: true },
    });
    if (!customer) {
      return NextResponse.json({ success: true, alreadyGone: true });
    }

    // Snapshot the customer's display name onto every order that still
    // points at them, so /dashboard/laundry and receipts keep the name
    // label after the FK's ON DELETE SET NULL fires. Do the snapshot
    // and the delete in a single transaction so we don't strand orders
    // with a null customer + null walkInName mid-run.
    const displayName = customer.customerCode
      ? `${customer.customerCode} ${customer.name}`
      : customer.name;

    await prisma.$transaction([
      prisma.order.updateMany({
        where: { customerId, walkInName: null },
        data: { walkInName: displayName },
      }),
      prisma.customer.delete({ where: { id: customerId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete customer:", msg);
    return NextResponse.json(
      { error: "Failed to delete customer", detail: msg },
      { status: 500 }
    );
  }
}

function parseThaiDate(dateStr: string): Date | null {
  // Accepts DD/MM/YYYY where YYYY may be Buddhist (พ.ศ., e.g. 2569) or
  // Gregorian (ค.ศ., e.g. 2026). The customer table renders Buddhist years
  // (formatDate → th-TH locale), so editing a customer round-trips a Buddhist
  // year back here — without conversion `new Date(2569, …)` would push the
  // expiry ~543 years into the future. Treat any year >= 2400 as Buddhist.
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [day, month, yearRaw] = parts.map(Number);
  if (!day || !month || !yearRaw) return null;
  const year = yearRaw >= 2400 ? yearRaw - 543 : yearRaw;
  // Anchor to Bangkok midnight so the stored instant reads back as the same
  // calendar day everywhere (formatDate is Asia/Bangkok).
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+07:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}
