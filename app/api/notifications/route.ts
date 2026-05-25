import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [pendingCustomers, renewPending, todayBookings, pendingOrders, stockItems] = await Promise.all([
      prisma.customer.count({ where: { status: "pending" } }),
      prisma.customer.count({ where: { renewPending: true } }),
      prisma.order.count({ where: { requestedDeliveryDate: { gte: today, lt: tomorrow } } }),
      prisma.order.count({ where: { status: "รอซักรีด" } }),
      // Low-stock count: every active stock item where quantity <= reorderLevel.
      // We have to read & compare in JS because Prisma can't compare two
      // columns inside a where clause.
      prisma.stock.findMany({
        where: { active: true },
        select: { quantity: true, reorderLevel: true },
      }),
    ]);
    const lowStockCount = stockItems.filter((s) => s.quantity <= s.reorderLevel).length;

    return NextResponse.json({
      pendingCustomers,
      renewPending,
      todayBookings,
      pendingOrders,
      lowStockCount,
      total: pendingCustomers + renewPending + todayBookings,
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json({ pendingCustomers: 0, renewPending: 0, todayBookings: 0, pendingOrders: 0, lowStockCount: 0, total: 0 });
  }
}
