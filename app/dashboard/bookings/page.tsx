"use client";

import { useState, useEffect, useCallback } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import { usePolling } from "@/lib/use-polling";

interface Booking {
  orderId: string;
  customer: string;
  phone: string;
  items: { name: string; qty: number }[];
  status: string;
  requestedDate: string;
  requestedTime: string;
  note: string;
  orderDate: string;
}

const statusBadge: Record<string, string> = {
  "รอซักรีด": "badge-blue",
  "พร้อมส่ง": "badge-green",
  "ส่งแล้ว": "badge-gray",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings");
      if (res.ok) setBookings(await res.json());
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  usePolling(fetchBookings, 30000);

  const filtered = searchQuery.trim()
    ? bookings.filter((b) => {
        const q = searchQuery.toLowerCase();
        return b.orderId.toLowerCase().includes(q) || b.customer.toLowerCase().includes(q) || b.phone.includes(q);
      })
    : bookings;

  const { paged, currentPage, totalPages, totalItems, itemsPerPage, setCurrentPage } = usePagination(filtered, 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">การจอง</h2>
      </div>

      <input
        type="text"
        placeholder="ค้นหา เลขออเดอร์ / ชื่อลูกค้า / เบอร์โทร..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">ไม่มีรายการจอง</div>
      ) : (
        <div className="space-y-3">
          {paged.map((b) => (
            <div key={b.orderId} className="card">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-bold text-blue-600 text-lg">{b.orderId}</span>
                  <span className="ml-2 text-slate-600">{b.customer}</span>
                </div>
                <span className={`badge ${statusBadge[b.status] || "badge-gray"}`}>{b.status}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div>
                  <span className="text-slate-400">วันที่จอง: </span>
                  <span className="font-medium text-slate-700">{b.requestedDate}</span>
                </div>
                <div>
                  <span className="text-slate-400">เวลา: </span>
                  <span className="font-medium text-slate-700">{b.requestedTime}</span>
                </div>
                <div>
                  <span className="text-slate-400">โทร: </span>
                  <span className="text-slate-700">{b.phone || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400">วันที่สั่ง: </span>
                  <span className="text-slate-700">{b.orderDate}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 mb-1">
                {b.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
              </div>

              {b.note && (
                <div className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 mt-1">
                  {b.note}
                </div>
              )}
            </div>
          ))}
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
        </div>
      )}
    </div>
  );
}
