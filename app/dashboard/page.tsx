"use client";

import { useState, useEffect, useCallback } from "react";

interface ChartData {
  date: string;
  orders: number;
  revenue: number;
  items: number;
}

interface RecentOrder {
  orderId: string;
  customer: string;
  status: string;
  totalAmount: number;
  date: string;
}

interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

const statusBadge: Record<string, string> = {
  "รอซักรีด": "badge-blue",
  "พร้อมส่ง": "badge-green",
  "กำลังจัดส่ง": "badge-yellow",
  "ส่งแล้ว": "badge-gray",
};

const statusColors: Record<string, string> = {
  "รอซักรีด": "#3b82f6",
  "พร้อมส่ง": "#10b981",
  "กำลังจัดส่ง": "#f59e0b",
  "ส่งแล้ว": "#94a3b8",
};

export default function DashboardPage() {
  const [totals, setTotals] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalItems: 0,
    todayOrders: 0,
    todayRevenue: 0,
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [last7, setLast7] = useState<ChartData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/summary");
      if (res.ok) {
        const data = await res.json();
        setTotals(data.totals);
        setStatusCounts(data.statusCounts);
        setLast7(data.last7);
        setTopItems(data.topItems);
        setRecentOrders(data.recentOrders);
        setCustomerCount(data.customerCount);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxRevenue = Math.max(...last7.map((d) => d.revenue), 1);
  const maxOrders = Math.max(...last7.map((d) => d.orders), 1);
  const totalStatusCount = Object.values(statusCounts).reduce((s, v) => s + v, 0) || 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "ออเดอร์วันนี้", value: String(totals.todayOrders), color: "#3b82f6", icon: "📋" },
          { label: "รายได้วันนี้", value: `${totals.todayRevenue.toLocaleString()} ฿`, color: "#10b981", icon: "💰" },
          { label: "ออเดอร์ทั้งหมด", value: String(totals.totalOrders), color: "#8b5cf6", icon: "📦" },
          { label: "ลูกค้าทั้งหมด", value: String(customerCount), color: "#f59e0b", icon: "👥" },
        ].map((card) => (
          <div key={card.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{card.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: card.color }}>
                  {card.value}
                </p>
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            รายได้ 7 วันล่าสุด
          </h3>
          <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-slate-500 mb-1">
                  {d.revenue > 0 ? `${d.revenue.toLocaleString()}` : ""}
                </span>
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${(d.revenue / maxRevenue) * 100}%`,
                    minHeight: d.revenue > 0 ? 8 : 2,
                    backgroundColor: "#3b82f6",
                    opacity: 0.8,
                  }}
                />
                <span className="text-xs text-slate-400 mt-1">{d.date}</span>
              </div>
            ))}
          </div>
          {last7.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">ยังไม่มีข้อมูล</p>
          )}
        </div>

        {/* Orders Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            จำนวนออเดอร์ 7 วันล่าสุด
          </h3>
          <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-40">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-slate-500 mb-1">
                  {d.orders > 0 ? d.orders : ""}
                </span>
                <div
                  className="w-full rounded-t-md transition-all duration-500"
                  style={{
                    height: `${(d.orders / maxOrders) * 100}%`,
                    minHeight: d.orders > 0 ? 8 : 2,
                    backgroundColor: "#8b5cf6",
                    opacity: 0.8,
                  }}
                />
                <span className="text-xs text-slate-400 mt-1">{d.date}</span>
              </div>
            ))}
          </div>
          {last7.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">ยังไม่มีข้อมูล</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Status Breakdown */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            สัดส่วนสถานะ
          </h3>
          <div className="space-y-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">{status}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${(count / totalStatusCount) * 100}%`,
                      backgroundColor: statusColors[status] || "#94a3b8",
                    }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(statusCounts).length === 0 && (
              <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Top Items */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            รายการยอดนิยม
          </h3>
          <div className="space-y-2">
            {topItems.slice(0, 5).map((item, i) => (
              <div
                key={item.name}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">
                    #{i + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-600">
                    {item.qty} ชิ้น
                  </span>
                  <span className="text-xs text-slate-400 ml-2">
                    {item.revenue.toLocaleString()}฿
                  </span>
                </div>
              </div>
            ))}
            {topItems.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            ภาพรวม
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">รายได้รวม</span>
              <span className="text-lg font-bold text-green-600">
                {totals.totalRevenue.toLocaleString()} ฿
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">จำนวนชิ้นรวม</span>
              <span className="text-lg font-bold text-purple-600">
                {totals.totalItems.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">เฉลี่ย/ออเดอร์</span>
              <span className="text-lg font-bold text-blue-600">
                {totals.totalOrders > 0
                  ? Math.round(totals.totalRevenue / totals.totalOrders).toLocaleString()
                  : 0}{" "}
                ฿
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          ออเดอร์ล่าสุด
        </h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขออเดอร์</th>
                <th>ลูกค้า</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th className="text-right">ยอดรวม</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.orderId}>
                  <td className="font-medium text-blue-600">{o.orderId}</td>
                  <td>{o.customer}</td>
                  <td>
                    <span className={`badge ${statusBadge[o.status] || "badge-gray"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="text-slate-500">{o.date}</td>
                  <td className="text-right font-medium">
                    {o.totalAmount.toLocaleString()} ฿
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    ยังไม่มีออเดอร์
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
