import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// End-of-day cash reconciliation: groups paid orders by Order.paymentMethod
// for a given Asia/Bangkok wall-clock day. Defaults to today.
export async function GET(request: NextRequest) {
  try {
    const dateParam = request.nextUrl.searchParams.get("date");
    const baseDate = dateParam ? new Date(`${dateParam}T00:00:00+07:00`) : new Date();
    const ymd = (d: Date) =>
      d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    const dayStr = ymd(baseDate);

    const from = new Date(`${dayStr}T00:00:00+07:00`);
    const to = new Date(`${dayStr}T23:59:59+07:00`);

    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: "paid",
        paidAt: { gte: from, lte: to },
      },
      select: {
        orderId: true,
        totalAmount: true,
        paymentMethod: true,
        paidAt: true,
        customer: { select: { name: true, customerCode: true } },
        walkInName: true,
      },
      orderBy: { paidAt: "asc" },
    });

    const buckets = new Map<string, { count: number; total: number }>();
    for (const o of orders) {
      const key = o.paymentMethod || "cash";
      const cur = buckets.get(key) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += o.totalAmount;
      buckets.set(key, cur);
    }

    const byMethod = Array.from(buckets.entries())
      .map(([method, v]) => ({ method, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    return NextResponse.json({
      date: dayStr,
      byMethod,
      grandTotal,
      count: orders.length,
      orders: orders.map((o) => ({
        orderId: o.orderId,
        amount: o.totalAmount,
        method: o.paymentMethod || "cash",
        paidAt: o.paidAt,
        customer: o.customer
          ? `${o.customer.customerCode ? o.customer.customerCode + " " : ""}${o.customer.name}`
          : o.walkInName || "",
      })),
    });
  } catch (error) {
    console.error("Failed to build EOD report:", error);
    return NextResponse.json({ error: "Failed to build EOD report" }, { status: 500 });
  }
}
