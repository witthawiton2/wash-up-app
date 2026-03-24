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

    if (type === "renew") {
      // Renew: add remaining on top of current + extend endDate
      const addItems = pkgData?.totalItems || 0;
      const currentRemaining = Math.max(customer.remaining, 0);
      const baseDate = customer.endDate && customer.endDate > new Date()
        ? customer.endDate
        : new Date();
      const newEndDate = pkgData
        ? new Date(baseDate.getTime() + pkgData.validDays * 24 * 60 * 60 * 1000)
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
    const endDate = pkgData
      ? new Date(Date.now() + pkgData.validDays * 24 * 60 * 60 * 1000)
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
