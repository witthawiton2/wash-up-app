import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateShort, todayStart } from "@/lib/timezone";

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true, customer: true },
      orderBy: { orderDate: "desc" },
    });

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const o of orders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    // Today's stats
    const today = todayStart();
    const todayOrders = orders.filter((o) => o.orderDate >= today);
    const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);

    // Group by date (last 30 days)
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

    for (const order of orders) {
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
        const existing = day.itemBreakdown.get(item.itemName) || {
          qty: 0,
          revenue: 0,
        };
        existing.qty += item.quantity;
        existing.revenue += item.total;
        day.itemBreakdown.set(item.itemName, existing);
      }
    }

    // Sort by date desc
    const sortedDays = Array.from(dailyMap.entries())
      .sort(([a], [b]) => b.localeCompare(a));

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

    // Chart data: last 7 days (sorted chronologically)
    const last7 = sortedDays.slice(0, 7).reverse().map(([, day]) => ({
      date: day.date.slice(0, 5), // DD/MM
      orders: day.orders,
      revenue: day.revenue,
      items: day.totalItems,
    }));

    // Top items overall
    const itemTotals = new Map<string, { qty: number; revenue: number }>();
    for (const order of orders) {
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

    // Recent orders
    const recentOrders = orders.slice(0, 5).map((o) => ({
      orderId: o.orderId,
      customer: o.customer?.name || o.walkInName || "ลูกค้าทั่วไป",
      status: o.status,
      totalAmount: o.totalAmount,
      date: formatDate(o.orderDate),
    }));

    // Totals
    const totals = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((s, o) => s + o.totalAmount, 0),
      totalItems: orders.reduce(
        (s, o) => s + o.items.reduce((s2, i) => s2 + i.quantity, 0),
        0
      ),
      todayOrders: todayOrders.length,
      todayRevenue,
    };

    const customerCount = await prisma.customer.count();

    // Today's bookings
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayBookings = await prisma.order.count({
      where: {
        requestedDeliveryDate: { gte: today, lt: tomorrow },
      },
    });

    // Pending renewals
    const pendingRenewals = await prisma.customer.count({
      where: { renewPending: true },
    });

    // Monthly revenue (current month)
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyRevenue = orders
      .filter((o) => o.orderDate >= monthStart)
      .reduce((s, o) => s + o.totalAmount, 0);

    // Top customers
    const customerTotals = new Map<string, { name: string; orders: number; revenue: number }>();
    for (const o of orders) {
      const name = o.customer?.name || o.walkInName || "ลูกค้าทั่วไป";
      const existing = customerTotals.get(name) || { name, orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += o.totalAmount;
      customerTotals.set(name, existing);
    }
    const topCustomers = Array.from(customerTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json({
      summary,
      totals: { ...totals, todayBookings, pendingRenewals, monthlyRevenue },
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
