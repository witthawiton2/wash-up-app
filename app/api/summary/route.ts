import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate, todayStart } from "@/lib/timezone";

const DETAIL_DAYS = 90;

export async function GET() {
  try {
    const today = todayStart();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const detailFrom = new Date(today);
    detailFrom.setDate(detailFrom.getDate() - DETAIL_DAYS);

    const [
      totalAgg,
      itemAgg,
      todayAgg,
      monthAgg,
      statusGroups,
      detailOrders,
      recentOrdersRaw,
      customerCount,
      todayBookings,
      pendingRenewals,
    ] = await Promise.all([
      prisma.order.aggregate({
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.orderItem.aggregate({ _sum: { quantity: true } }),
      prisma.order.aggregate({
        where: { orderDate: { gte: today, lt: tomorrow } },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.order.aggregate({
        where: { orderDate: { gte: monthStart } },
        _sum: { totalAmount: true },
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.order.findMany({
        where: { orderDate: { gte: detailFrom } },
        include: { items: true, customer: true },
        orderBy: { orderDate: "desc" },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { orderDate: "desc" },
        include: { customer: true },
      }),
      prisma.customer.count(),
      prisma.order.count({
        where: { requestedDeliveryDate: { gte: today, lt: tomorrow } },
      }),
      prisma.customer.count({ where: { renewPending: true } }),
    ]);

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const s of statusGroups) {
      statusCounts[s.status] = s._count._all;
    }

    // Daily aggregation (over the detail window)
    const dailyMap = new Map<
      string,
      {
        dateSort: string;
        date: string;
        orders: number;
        revenue: number;
        totalItems: number;
        itemBreakdown: Map<string, { qty: number; revenue: number }>;
        customers: Set<string>;
      }
    >();

    for (const order of detailOrders) {
      const d = order.orderDate;
      const dateSort = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dateKey = formatDate(d);

      if (!dailyMap.has(dateSort)) {
        dailyMap.set(dateSort, {
          dateSort,
          date: dateKey,
          orders: 0,
          revenue: 0,
          totalItems: 0,
          itemBreakdown: new Map(),
          customers: new Set(),
        });
      }

      const day = dailyMap.get(dateSort)!;
      day.orders += 1;
      day.revenue += order.totalAmount;
      day.customers.add(order.customer?.name || order.walkInName || "ลูกค้าทั่วไป");

      for (const item of order.items) {
        day.totalItems += item.quantity;
        const existing = day.itemBreakdown.get(item.itemName) || { qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.total;
        day.itemBreakdown.set(item.itemName, existing);
      }
    }

    const sortedDays = Array.from(dailyMap.entries()).sort(([a], [b]) =>
      b.localeCompare(a)
    );

    const summary = sortedDays.map(([, day]) => ({
      date: day.date,
      orders: day.orders,
      revenue: day.revenue,
      totalItems: day.totalItems,
      customers: day.customers.size,
      items: Array.from(day.itemBreakdown.entries()).map(([name, data]) => ({
        name,
        qty: data.qty,
        revenue: data.revenue,
      })),
    }));

    const last7 = sortedDays.slice(0, 7).reverse().map(([, day]) => ({
      date: day.date.slice(0, 5),
      orders: day.orders,
      revenue: day.revenue,
      items: day.totalItems,
    }));

    // Top items (within detail window)
    const itemTotals = new Map<string, { qty: number; revenue: number }>();
    for (const order of detailOrders) {
      for (const item of order.items) {
        const existing = itemTotals.get(item.itemName) || { qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.total;
        itemTotals.set(item.itemName, existing);
      }
    }
    const topItems = Array.from(itemTotals.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);

    // Top customers (within detail window)
    const customerTotals = new Map<string, { name: string; orders: number; revenue: number }>();
    for (const o of detailOrders) {
      const name = o.customer?.name || o.walkInName || "ลูกค้าทั่วไป";
      const existing = customerTotals.get(name) || { name, orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += o.totalAmount;
      customerTotals.set(name, existing);
    }
    const topCustomers = Array.from(customerTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const recentOrders = recentOrdersRaw.map((o) => ({
      orderId: o.orderId,
      customer: o.customer?.name || o.walkInName || "ลูกค้าทั่วไป",
      status: o.status,
      totalAmount: o.totalAmount,
      date: formatDate(o.orderDate),
    }));

    const totals = {
      totalOrders: totalAgg._count._all,
      totalRevenue: totalAgg._sum.totalAmount ?? 0,
      totalItems: itemAgg._sum.quantity ?? 0,
      todayOrders: todayAgg._count._all,
      todayRevenue: todayAgg._sum.totalAmount ?? 0,
      todayBookings,
      pendingRenewals,
      monthlyRevenue: monthAgg._sum.totalAmount ?? 0,
    };

    return NextResponse.json({
      summary,
      totals,
      statusCounts,
      last7,
      topItems,
      topCustomers,
      recentOrders,
      customerCount,
    });
  } catch (error) {
    console.error("Failed to fetch summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}
