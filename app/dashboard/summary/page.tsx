"use client";

import { useState, useEffect, useCallback } from "react";

interface ItemBreakdown {
  name: string;
  qty: number;
  revenue: number;
}

interface DailySummary {
  date: string;
  orders: number;
  revenue: number;
  totalItems: number;
  customers: number;
  items: ItemBreakdown[];
}

interface ChartData {
  date: string;
  orders: number;
  revenue: number;
  items: number;
}

interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

interface Totals {
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  todayOrders: number;
  todayRevenue: number;
}

export default function SummaryPage() {
  const [summary, setSummary] = useState<DailySummary[]>([]);
  const [totals, setTotals] = useState<Totals>({
    totalOrders: 0,
    totalRevenue: 0,
    totalItems: 0,
    todayOrders: 0,
    todayRevenue: 0,
  });
  const [last7, setLast7] = useState<ChartData[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/summary");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTotals(data.totals);
        setLast7(data.last7);
        setTopItems(data.topItems);
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const maxRevenue = Math.max(...last7.map((d) => d.revenue), 1);
  const maxItems = Math.max(...last7.map((d) => d.items), 1);
  const maxTopQty = Math.max(...topItems.map((i) => i.qty), 1);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Summary</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "รายได้รวม", value: `${totals.totalRevenue.toLocaleString()} ฿`, color: "#10b981", icon: "💰" },
          { label: "ออเดอร์รวม", value: String(totals.totalOrders), color: "#2563eb", icon: "📋" },
          { label: "จำนวนชิ้นรวม", value: `${totals.totalItems.toLocaleString()} ชิ้น`, color: "#8b5cf6", icon: "👕" },
        ].map((card) => (
          <div key={card.label} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: card.color }}>
                  {card.value}
                </p>
              </div>
              <span className="text-3xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">รายได้ 7 วันล่าสุด</h3>
          <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-44">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-slate-500 mb-1">
                  {d.revenue > 0 ? `${d.revenue.toLocaleString()}` : ""}
                </span>
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${(d.revenue / maxRevenue) * 100}%`,
                    minHeight: d.revenue > 0 ? 8 : 2,
                    backgroundColor: "#10b981",
                    opacity: 0.8,
                  }}
                />
                <span className="text-xs text-slate-400 mt-1">{d.date}</span>
              </div>
            ))}
          </div>
          {last7.length === 0 && <p className="text-center text-slate-400 text-sm py-8">ยังไม่มีข้อมูล</p>}
        </div>

        {/* Items Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">จำนวนชิ้น 7 วันล่าสุด</h3>
          <div className="flex items-end gap-1 sm:gap-2 h-32 sm:h-44">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-slate-500 mb-1">
                  {d.items > 0 ? d.items : ""}
                </span>
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${(d.items / maxItems) * 100}%`,
                    minHeight: d.items > 0 ? 8 : 2,
                    backgroundColor: "#8b5cf6",
                    opacity: 0.8,
                  }}
                />
                <span className="text-xs text-slate-400 mt-1">{d.date}</span>
              </div>
            ))}
          </div>
          {last7.length === 0 && <p className="text-center text-slate-400 text-sm py-8">ยังไม่มีข้อมูล</p>}
        </div>
      </div>

      {/* Top Items horizontal bar */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">รายการยอดนิยม</h3>
        <div className="space-y-3">
          {topItems.slice(0, 8).map((item) => (
            <div key={item.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600 font-medium">{item.name}</span>
                <span className="text-slate-500">
                  {item.qty} ชิ้น / {item.revenue.toLocaleString()} ฿
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${(item.qty / maxTopQty) * 100}%`,
                    backgroundColor: "#3b82f6",
                  }}
                />
              </div>
            </div>
          ))}
          {topItems.length === 0 && <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีข้อมูล</p>}
        </div>
      </div>

      {/* Daily Summary Table */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">สรุปรายวัน</h3>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th className="text-right">ออเดอร์</th>
                <th className="text-right hide-mobile">ลูกค้า</th>
                <th className="text-right">จำนวนชิ้น</th>
                <th className="text-right">รายได้</th>
                <th className="text-center">รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">กำลังโหลด...</td>
                </tr>
              ) : summary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">ยังไม่มีข้อมูล</td>
                </tr>
              ) : (
                summary.map((row) => (
                  <>
                    <tr key={row.date}>
                      <td className="font-medium">{row.date}</td>
                      <td className="text-right">{row.orders}</td>
                      <td className="text-right hide-mobile">{row.customers}</td>
                      <td className="text-right">{row.totalItems}</td>
                      <td className="text-right text-green-600 font-medium">
                        {row.revenue.toLocaleString()} ฿
                      </td>
                      <td className="text-center">
                        <button
                          onClick={() =>
                            setExpandedDate(expandedDate === row.date ? null : row.date)
                          }
                          className="text-blue-500 hover:text-blue-700 text-sm"
                        >
                          {expandedDate === row.date ? "ซ่อน" : "ดูรายการ"}
                        </button>
                      </td>
                    </tr>
                    {expandedDate === row.date && (
                      <tr key={`${row.date}-detail`}>
                        <td colSpan={6} className="bg-slate-50 px-6 py-3">
                          <div className="text-sm font-medium text-slate-600 mb-2">
                            รายการในวันที่ {row.date}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {row.items.map((item) => (
                              <div
                                key={item.name}
                                className="bg-white rounded-lg px-3 py-2 border border-slate-200"
                              >
                                <div className="font-medium text-slate-700 text-sm">{item.name}</div>
                                <div className="text-xs text-slate-400">
                                  {item.qty} ชิ้น — {item.revenue.toLocaleString()} ฿
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
