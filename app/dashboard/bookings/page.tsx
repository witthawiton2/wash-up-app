"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePolling } from "@/lib/use-polling";
import { useAuth } from "@/lib/auth-context";

interface Booking {
  orderId: string;
  customer: string;
  phone: string;
  address: string;
  items: { name: string; qty: number }[];
  status: string;
  requestedDate: string;
  requestedTime: string;
  activity: string;
  deliveryMethod: string;
  note: string;
  orderDate: string;
}

const statusBadge: Record<string, string> = {
  "รอซักรีด": "badge-blue",
  "พร้อมส่ง": "badge-green",
  "ส่งแล้ว": "badge-gray",
};

// Minutes-since-midnight for an "H:MM"/"HH:MM" slot. Customer-picked slots
// are stored non-padded ("9:00"), so string compare would sort "9:00" after
// "10:00"; sort numerically instead. Malformed/empty → sorts last.
function timeMinutes(time: string): number {
  const [h, m] = (time || "").split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return Number.MAX_SAFE_INTEGER;
  return h * 60 + m;
}

// Colour the time chip by rough period so admins can still eyeball
// morning vs afternoon vs evening at a glance, even though each
// concrete HH:MM slot renders as its own group.
function timeAccent(time: string): string {
  const [h] = time.split(":").map((n) => parseInt(n, 10));
  if (isNaN(h)) return "bg-slate-50 border-slate-200 text-slate-700";
  if (h >= 9 && h < 12) return "bg-amber-50 border-amber-200 text-amber-800";
  if (h >= 12 && h < 18) return "bg-blue-50 border-blue-200 text-blue-800";
  if (h >= 18 && h < 21) return "bg-indigo-50 border-indigo-200 text-indigo-800";
  return "bg-slate-50 border-slate-200 text-slate-700";
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Convert HTML date input (YYYY-MM-DD Gregorian) to the DD/MM/YYYY (Buddhist)
// string that /api/bookings returns in `requestedDate`.
const isoToThaiDate = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${parseInt(y, 10) + 543}`;
};

export default function BookingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  const handleCancel = async (orderId: string) => {
    if (!confirm(`ยกเลิกคิวของออเดอร์ ${orderId}?\nระบบจะแจ้งลูกค้าทาง LINE`)) return;
    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/bookings?orderId=${encodeURIComponent(orderId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchBookings();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "ยกเลิกคิวไม่สำเร็จ");
      }
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  usePolling(fetchBookings, 30000);

  const thaiSelected = isoToThaiDate(selectedDate);

  const filtered = (() => {
    let list = selectedDate
      ? bookings.filter((b) => b.requestedDate === thaiSelected)
      : bookings;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.orderId.toLowerCase().includes(q) ||
          b.customer.toLowerCase().includes(q) ||
          b.phone.includes(q)
      );
    }
    // Sort by time ascending. Slot strings may be non-padded ("9:00"), so
    // compare by minutes-of-day, not lexicographically.
    return [...list].sort((a, b) => timeMinutes(a.requestedTime) - timeMinutes(b.requestedTime));
  })();

  // Bucket by concrete HH:MM. Missing/malformed times fall into a
  // "--:--" bucket rendered last.
  const grouped = useMemo(() => {
    const byTime = new Map<string, Booking[]>();
    for (const b of filtered) {
      const key = b.requestedTime || "--:--";
      if (!byTime.has(key)) byTime.set(key, []);
      byTime.get(key)!.push(b);
    }
    return Array.from(byTime.entries()).sort(([a], [b]) => {
      if (a === "--:--") return 1;
      if (b === "--:--") return -1;
      return timeMinutes(a) - timeMinutes(b);
    });
  }, [filtered]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">การจอง</h2>
        <span className="text-sm text-slate-500">
          {filtered.length} คิวในวันที่นี้
        </span>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">เลือกวันที่</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedDate(todayIso())}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              วันนี้
            </button>
            <button
              onClick={() => setSelectedDate("")}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ทั้งหมด
            </button>
          </div>
        </div>
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
        <div className="text-center py-12 text-slate-400">
          {selectedDate ? `ไม่มีคิวในวันที่ ${thaiSelected}` : "ไม่มีรายการจอง"}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([time, list]) => {
            if (list.length === 0) return null;
            return (
              <section key={time}>
                <div className={`flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg border ${timeAccent(time)}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold tabular-nums">{time}</span>
                    <span className="text-xs opacity-75">น.</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70">
                    {list.length} คิว
                  </span>
                </div>

                <div className="space-y-3">
                  {list.map((b) => (
                    <div key={b.orderId} className="card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-blue-600 text-base">{b.orderId}</span>
                          <span className="ml-1 text-slate-600 text-sm">{b.customer}</span>
                        </div>
                        <span className={`badge ${statusBadge[b.status] || "badge-gray"}`}>{b.status}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                        <div>
                          <span className="text-slate-400">วันที่จอง: </span>
                          <span className="font-medium text-slate-700">{b.requestedDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">โทร: </span>
                          <span className="text-slate-700">{b.phone || "-"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">ที่อยู่: </span>
                          <span className="text-slate-700">{b.address || "-"}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        {b.activity && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                            🧺 {b.activity}
                          </span>
                        )}
                        {b.deliveryMethod && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            📦 {b.deliveryMethod}
                          </span>
                        )}
                      </div>

                      {b.items.length > 0 && (
                        <div className="text-xs text-slate-500 mb-1">
                          {b.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                        </div>
                      )}

                      {b.note && (
                        <div className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 mt-1">
                          {b.note}
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleCancel(b.orderId)}
                            disabled={cancellingId === b.orderId}
                            className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 disabled:opacity-50"
                          >
                            {cancellingId === b.orderId ? "กำลังยกเลิก..." : "ยกเลิกคิว"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
