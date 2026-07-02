import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type } = body; // type: "approve" (new customer) or "renew" (refill package)

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const pkgData = await prisma.package.findFirst({
      where: { name: customer.package || "", active: true },
    });

    // validDays === 0 marks a "no-expiry" package (typically per-piece
    // plans). We keep endDate as null in that case so the expiry alerts
    // in /api/orders never fire and receipts render "-".
    const validDays = pkgData?.validDays || 0;

    if (type === "renew") {
      // Renew: add new package items on top of the current balance, keeping
      // any negative balance so customers who overdrew their previous
      // package still owe those items (e.g. -10 + 50 = 40, not 50).
      const addItems = pkgData?.totalItems || 0;
      const currentRemaining = customer.remaining;
      const baseDate = customer.endDate && customer.endDate > new Date()
        ? customer.endDate
        : new Date();
      const newEndDate = pkgData && validDays > 0
        ? new Date(baseDate.getTime() + validDays * 24 * 60 * 60 * 1000)
        : null;

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          remaining: currentRemaining + addItems,
          endDate: newEndDate,
          renewPending: false,
        },
      });

      return NextResponse.json({ success: true, customer: updated });
    }

    // Default: approve new customer
    const remaining = pkgData?.totalItems || 0;
    const endDate = pkgData && validDays > 0
      ? new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)
      : null;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        status: "approved",
        remaining,
        endDate,
        renewPending: false,
      },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json(
      { error: "Failed to approve customer" },
      { status: 500 }
    );
  }
}
