import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate, todayStart } from "@/lib/timezone";

const DETAIL_DAYS = 90;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topDateParam = searchParams.get("topDate"); // YYYY-MM-DD (Bangkok)

    const today = todayStart();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const detailFrom = new Date(today);
    detailFrom.setDate(detailFrom.getDate() - DETAIL_DAYS);

    // Optional single-day window for top items
    let topDayStart: Date | null = null;
    let topDayEnd: Date | null = null;
    if (topDateParam) {
      topDayStart = new Date(`${topDateParam}T00:00:00+07:00`);
      topDayEnd = new Date(`${topDateParam}T23:59:59.999+07:00`);
    }

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

    // Map every item name in the detail window → its category. Best-effort:
    // when a name exists in multiple categories the first active one wins.
    const allItemNames = Array.from(
      new Set(detailOrders.flatMap((o) => o.items.map((i) => i.itemName)))
    );
    const serviceItems = allItemNames.length
      ? await prisma.serviceItem.findMany({
          where: { name: { in: allItemNames }, active: true },
          select: { name: true, category: true },
        })
      : [];
    const categoryByName = new Map<string, string>();
    for (const si of serviceItems) {
      if (!categoryByName.has(si.name)) categoryByName.set(si.name, si.category);
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
        category: categoryByName.get(name) || "อื่นๆ",
      })),
    }));

    const last7 = sortedDays.slice(0, 7).reverse().map(([, day]) => ({
      date: day.date.slice(0, 5),
      orders: day.orders,
      revenue: day.revenue,
      items: day.totalItems,
    }));

    // Top items: optionally narrowed to a single day, otherwise over the
    // detail window.
    const topSourceOrders = topDayStart && topDayEnd
      ? detailOrders.filter((o) => o.orderDate >= topDayStart! && o.orderDate <= topDayEnd!)
      : detailOrders;

    const itemTotals = new Map<string, { qty: number; revenue: number }>();
    for (const order of topSourceOrders) {
      for (const item of order.items) {
        const existing = itemTotals.get(item.itemName) || { qty: 0, revenue: 0 };
        existing.qty += item.quantity;
        existing.revenue += item.total;
        itemTotals.set(item.itemName, existing);
      }
    }

    const topItems = Array.from(itemTotals.entries())
      .map(([name, data]) => ({
        name,
        ...data,
        category: categoryByName.get(name) || "อื่นๆ",
      }))
      .sort((a, b) => b.qty - a.qty);

    // Ironer stats: parse "รีดโดย: <name>" out of order notes from the same
    // window as top items (single day if topDate set, else 90d).
    const IRONED_RE = /รีดโดย:\s*([^|]+?)(?:\s*\||$)/;
    type IronerOrder = {
      orderId: string;
      customer: string;
      date: string;
      totalAmount: number;
      items: { name: string; qty: number }[];
    };
    const ironerMap = new Map<string, IronerOrder[]>();
    for (const o of topSourceOrders) {
      const note = o.note || "";
      const m = note.match(IRONED_RE);
      if (!m) continue;
      const ironerName = m[1].trim();
      if (!ironerName) continue;
      const list = ironerMap.get(ironerName) || [];
      list.push({
        orderId: o.orderId,
        customer: o.customer?.name || o.walkInName || "ลูกค้าทั่วไป",
        date: formatDate(o.orderDate),
        totalAmount: o.totalAmount,
        items: o.items.map((i) => ({ name: i.itemName, qty: i.quantity })),
      });
      ironerMap.set(ironerName, list);
    }
    const ironers = Array.from(ironerMap.entries())
      .map(([name, orders]) => ({
        name,
        count: orders.length,
        totalPieces: orders.reduce(
          (s, o) => s + o.items.reduce((s2, i) => s2 + i.qty, 0),
          0
        ),
        orders,
      }))
      .sort((a, b) => b.count - a.count);

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
      ironers,
      recentOrders,
      customerCount,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Failed to fetch summary:", msg, stack);
    return NextResponse.json(
      { error: "Failed to fetch summary", detail: msg },
      { status: 500 }
    );
  }
}
