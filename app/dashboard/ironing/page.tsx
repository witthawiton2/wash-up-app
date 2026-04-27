"use client";

import { useState, useEffect, useCallback } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import { usePolling } from "@/lib/use-polling";

interface IroningItem {
  name: string;
  qty: number;
  price: number;
}

interface IroningOrder {
  orderId: string;
  customer: string;
  phone: string;
  items: IroningItem[];
  status: string;
  date: string;
  totalAmount: number;
}

const statusBadge: Record<string, string> = {
  "รอซักรีด": "badge-blue",
  "พร้อมส่ง": "badge-green",
  "ส่งแล้ว": "badge-gray",
};

const filters = ["ทั้งหมด", "รอซักรีด", "พร้อมส่ง"];

export default function IroningPage() {
  const [orders, setOrders] = useState<IroningOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean[]>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  usePolling(fetchOrders, 30000);

  const filtered = (() => {
    let list = activeFilter === "ทั้งหมด"
      ? orders
      : orders.filter((o) => o.status === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((o) =>
        o.orderId.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        (o.phone || "").includes(q)
      );
    }
    return list;
  })();

  const { paged, currentPage, totalPages, totalItems, itemsPerPage, setCurrentPage } = usePagination(filtered, 20);

  const getChecked = (orderId: string, itemCount: number): boolean[] => {
    return checked[orderId] || new Array(itemCount).fill(false);
  };

  const toggleItem = (orderId: string, itemIndex: number, totalItems: number) => {
    const current = getChecked(orderId, totalItems);
    const updated = [...current];
    updated[itemIndex] = !updated[itemIndex];
    setChecked({ ...checked, [orderId]: updated });
  };

  const toggleAll = (orderId: string, totalItems: number) => {
    const current = getChecked(orderId, totalItems);
    const allChecked = current.every(Boolean);
    setChecked({ ...checked, [orderId]: new Array(totalItems).fill(!allChecked) });
  };

  const allItemsChecked = (orderId: string, itemCount: number): boolean => {
    const c = checked[orderId];
    if (!c || c.length === 0) return false;
    return c.every(Boolean);
  };

  const checkedCount = (orderId: string, itemCount: number): number => {
    const c = checked[orderId];
    if (!c) return 0;
    return c.filter(Boolean).length;
  };

  const handleMarkReady = async (orderId: string) => {
    setUpdating(orderId);
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "พร้อมส่ง" }),
      });
      if (res.ok) {
        await fetchOrders();
        const newChecked = { ...checked };
        delete newChecked[orderId];
        setChecked(newChecked);
      }
    } catch (error) {
      console.error("Failed to update order:", error);
    } finally {
      setUpdating(null);
    }
  };

  // 1 checkbox per item row (เสื้อ x10 = 1 checkbox)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Ironing</h2>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`filter-tab ${activeFilter === f ? "active" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="ค้นหา เลขออเดอร์ / ชื่อลูกค้า..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">ไม่มีรายการ</div>
      ) : (
        <div className="space-y-4">
          {paged.map((o) => {
            const itemCount = o.items.length;
            const orderChecked = getChecked(o.orderId, itemCount);
            const done = checkedCount(o.orderId, itemCount);
            const allDone = allItemsChecked(o.orderId, itemCount);
            const isReady = o.status === "พร้อมส่ง" || o.status === "ส่งแล้ว";
            const totalPieces = o.items.reduce((s, i) => s + i.qty, 0);

            return (
              <div key={o.orderId} className="card">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-blue-600 text-lg">{o.orderId}</span>
                    <span className="ml-2 text-slate-600">{o.customer}</span>
                  </div>
                  <span className={`badge ${statusBadge[o.status] || "badge-gray"}`}>
                    {o.status}
                  </span>
                </div>

                {o.phone && (
                  <p className="text-xs text-slate-400 mb-2">โทร: {o.phone}</p>
                )}

                {/* Progress */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${itemCount > 0 ? (done / itemCount) * 100 : 0}%`,
                        backgroundColor: allDone ? "#10b981" : "#3b82f6",
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {done}/{itemCount} รายการ ({totalPieces} ชิ้น)
                  </span>
                </div>

                {/* Select all */}
                {!isReady && (
                  <button
                    onClick={() => toggleAll(o.orderId, itemCount)}
                    className="text-xs text-blue-600 hover:text-blue-800 mb-2"
                  >
                    {orderChecked.every(Boolean) ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
                  </button>
                )}

                {/* Items checklist */}
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  {o.items.map((item, idx) => (
                    <label
                      key={`${o.orderId}-${idx}`}
                      className={`flex items-center gap-3 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
                        orderChecked[idx]
                          ? "bg-green-50"
                          : "hover:bg-slate-50"
                      } ${isReady ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isReady || orderChecked[idx] || false}
                        onChange={() => toggleItem(o.orderId, idx, itemCount)}
                        disabled={isReady}
                        className="w-5 h-5 rounded border-slate-300 text-green-500 focus:ring-green-400"
                      />
                      <span className={`text-sm flex-1 ${orderChecked[idx] ? "line-through text-slate-400" : "text-slate-700"}`}>
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        x{item.qty}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Action button */}
                {o.status === "รอซักรีด" && (
                  <div className="border-t border-slate-100 pt-3 mt-3">
                    <button
                      onClick={() => handleMarkReady(o.orderId)}
                      disabled={!allDone || updating === o.orderId}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        allDone
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      } disabled:opacity-50`}
                    >
                      {updating === o.orderId ? "กำลังบันทึก..." : "รีดเสร็จ → พร้อมส่ง"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
        </div>
      )}
    </div>
  );
}
