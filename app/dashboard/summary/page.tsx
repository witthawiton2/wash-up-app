"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePolling } from "@/lib/use-polling";
import { useRequireAdmin } from "@/lib/use-require-admin";

interface ItemBreakdown {
  name: string;
  qty: number;
  revenue: number;
  category: string;
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
  category: string;
}

interface IronerOrder {
  orderId: string;
  customer: string;
  date: string;
  totalAmount: number;
  items: { name: string; qty: number }[];
}

interface IronerStats {
  name: string;
  count: number;
  totalPieces: number;
  orders: IronerOrder[];
}

interface Totals {
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  todayOrders: number;
  todayRevenue: number;
}

export default function SummaryPage() {
  useRequireAdmin();
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
  const [ironers, setIroners] = useState<IronerStats[]>([]);
  const [expandedIroner, setExpandedIroner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const [exportFrom, setExportFrom] = useState(today);
  const [exportTo, setExportTo] = useState(today);
  const [topDate, setTopDate] = useState(today);

  const fetchSummary = useCallback(async () => {
    try {
      const url = topDate
        ? `/api/summary?topDate=${topDate}`
        : "/api/summary";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTotals(data.totals);
        setLast7(data.last7);
        setTopItems(data.topItems);
        setIroners(data.ironers || []);
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    } finally {
      setLoading(false);
    }
  }, [topDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  usePolling(fetchSummary, 30000);

  const maxRevenue = Math.max(...last7.map((d) => d.revenue), 1);
  const maxItems = Math.max(...last7.map((d) => d.items), 1);
  const maxTopQty = Math.max(...topItems.map((i) => i.qty), 1);

  // Convert the YYYY-MM-DD filter to the DD/MM/YYYY (Buddhist) string used
  // in summary[].date so the daily breakdown table can match.
  const thaiSelected = useMemo(() => {
    if (!topDate) return "";
    const [y, m, d] = topDate.split("-");
    return `${d}/${m}/${parseInt(y, 10) + 543}`;
  }, [topDate]);

  const visibleSummary = useMemo(
    () => (topDate ? summary.filter((s) => s.date === thaiSelected) : summary),
    [summary, topDate, thaiSelected]
  );

  // Pre-group top items by category once per topItems change.
  const topItemsByCategory = useMemo(() => {
    return topItems.reduce((acc, item) => {
      (acc[item.category] ||= []).push(item);
      return acc;
    }, {} as Record<string, TopItem[]>);
  }, [topItems]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Summary</h2>
      </div>

      {/* Export Section */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Export ข้อมูล</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">จากวันที่</label>
            <input
              type="date"
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">ถึงวันที่</label>
            <input
              type="date"
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <a
            href={`/api/export?type=orders${exportFrom ? `&from=${exportFrom}` : ""}${exportTo ? `&to=${exportTo}` : ""}`}
            className="text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors"
          >
            Export ออเดอร์
          </a>
          <a
            href={`/api/export?type=customers`}
            className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
          >
            Export ลูกค้า
          </a>
        </div>
        {(exportFrom || exportTo) && (
          <p className="text-xs text-slate-400 mt-2">
            {exportFrom && exportTo ? `ช่วง ${exportFrom} ถึง ${exportTo}` : exportFrom ? `ตั้งแต่ ${exportFrom}` : `ถึง ${exportTo}`}
          </p>
        )}
      </div>

      {/* Date Filter — affects daily sections (Top items, Ironers, Daily table) */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">ดูข้อมูลของวันที่</label>
            <input
              type="date"
              value={topDate}
              onChange={(e) => setTopDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTopDate(today)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              วันนี้
            </button>
            <button
              onClick={() => setTopDate("")}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              90 วันล่าสุด
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">
          ฟิลเตอร์นี้ใช้กับ: รายการยอดนิยม, สรุปคนรีด, ตารางสรุปรายวัน
          {topDate ? "" : " (ปัจจุบันแสดง 90 วันล่าสุด)"}
        </p>
      </div>

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

      {/* Top Items grouped by category */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-700">รายการยอดนิยม</h3>
          <span className="text-[11px] text-slate-400">
            {topDate ? `วันที่ ${thaiSelected}` : "90 วันล่าสุด"}
          </span>
        </div>

        {topItems.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(topItemsByCategory).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                    {category}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {items.length} รายการ · รวม {items.reduce((s, i) => s + i.qty, 0)} ชิ้น
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={`${category}-${item.name}`}>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ironers summary */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">สรุปคนรีด</h3>
          <span className="text-[11px] text-slate-400">
            {topDate ? `วันที่ ${topDate}` : "90 วันล่าสุด"}
          </span>
        </div>

        {ironers.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-4">ยังไม่มีข้อมูลคนรีด</p>
        ) : (
          <div className="space-y-2">
            {ironers.map((ir) => (
              <div key={ir.name} className="rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() =>
                    setExpandedIroner(expandedIroner === ir.name ? null : ir.name)
                  }
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm shrink-0">
                      {ir.name.charAt(0)}
                    </div>
                    <span className="font-medium text-slate-800 truncate">{ir.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-600">
                      <span className="font-bold text-blue-600">{ir.count}</span> ออเดอร์
                    </span>
                    <span className="text-slate-400">
                      {ir.totalPieces} ชิ้น
                    </span>
                    <span className="text-slate-400">
                      {expandedIroner === ir.name ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {expandedIroner === ir.name && (
                  <div className="px-3 py-2 bg-white">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 text-left">
                          <th className="font-medium py-1.5">ออเดอร์</th>
                          <th className="font-medium py-1.5">ลูกค้า</th>
                          <th className="font-medium py-1.5">วันที่</th>
                          <th className="font-medium py-1.5">รายการ</th>
                          <th className="font-medium py-1.5 text-right">ยอด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ir.orders.map((o) => (
                          <tr key={o.orderId} className="border-t border-slate-100">
                            <td className="py-1.5 font-mono text-blue-600">{o.orderId}</td>
                            <td className="py-1.5 text-slate-700">{o.customer}</td>
                            <td className="py-1.5 text-slate-500">{o.date}</td>
                            <td className="py-1.5 text-slate-500">
                              {o.items.map((i) => `${i.name}×${i.qty}`).join(", ")}
                            </td>
                            <td className="py-1.5 text-right font-medium text-slate-700">
                              {o.totalAmount.toLocaleString()} ฿
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
              ) : visibleSummary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    {topDate ? `ไม่มีข้อมูลในวันที่ ${thaiSelected}` : "ยังไม่มีข้อมูล"}
                  </td>
                </tr>
              ) : (
                visibleSummary.map((row) => (
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
                          <div className="text-sm font-medium text-slate-600 mb-3">
                            รายการในวันที่ {row.date}
                          </div>
                          <div className="space-y-3">
                            {Object.entries(
                              row.items.reduce((acc, item) => {
                                (acc[item.category] ||= []).push(item);
                                return acc;
                              }, {} as Record<string, ItemBreakdown[]>)
                            ).map(([category, items]) => (
                              <div key={category}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[11px] font-semibold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                                    {category}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    รวม {items.reduce((s, i) => s + i.qty, 0)} ชิ้น
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {items.map((item) => (
                                    <div
                                      key={`${category}-${item.name}`}
                                      className="bg-white rounded-lg px-3 py-2 border border-slate-200"
                                    >
                                      <div className="font-medium text-slate-700 text-sm">{item.name}</div>
                                      <div className="text-xs text-slate-400">
                                        {item.qty} ชิ้น — {item.revenue.toLocaleString()} ฿
                                      </div>
                                    </div>
                                  ))}
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
