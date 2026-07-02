"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePolling } from "@/lib/use-polling";

interface Booking {
  orderId: string;
  customer: string;
  phone: string;
  address: string;
  items: { name: string; qty: number }[];
  status: string;
  requestedDate: string;
  requestedTime: string;
  deliveryMethod: string;
  note: string;
  orderDate: string;
}

const statusBadge: Record<string, string> = {
  "รอซักรีด": "badge-blue",
  "พร้อมส่ง": "badge-green",
  "ส่งแล้ว": "badge-gray",
};

type SlotKey = "morning" | "afternoon" | "evening" | "other";

type MethodKey = "home" | "self" | "unknown";

const METHOD_GROUPS: { key: MethodKey; label: string; icon: string; accent: string }[] = [
  { key: "home",    label: "ฝากที่พัก",  icon: "🏠", accent: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { key: "self",    label: "รับที่ร้าน", icon: "🏪", accent: "bg-sky-50 border-sky-200 text-sky-800" },
  { key: "unknown", label: "ไม่ระบุ",    icon: "❓", accent: "bg-slate-50 border-slate-200 text-slate-700" },
];

function methodOf(deliveryMethod: string): MethodKey {
  if (deliveryMethod === "ฝากที่พัก") return "home";
  if (deliveryMethod === "รับด้วยตัวเอง") return "self";
  return "unknown";
}

// Same slot boundaries the /my booking form uses so admin's grouping
// matches what the customer picked on the LIFF side.
const SLOTS: {
  key: SlotKey;
  label: string;
  range: string;
  accent: string;
}[] = [
  { key: "morning",   label: "ช่วงเช้า",  range: "09:00-12:00", accent: "bg-amber-50 border-amber-200 text-amber-800" },
  { key: "afternoon", label: "ช่วงบ่าย",  range: "12:00-18:00", accent: "bg-blue-50 border-blue-200 text-blue-800" },
  { key: "evening",   label: "ช่วงเย็น",  range: "18:00-20:30", accent: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { key: "other",     label: "อื่นๆ",     range: "นอกช่วงหลัก", accent: "bg-slate-50 border-slate-200 text-slate-700" },
];

function slotOf(time: string): SlotKey {
  // requestedTime is "HH:MM" zero-padded.
  const [h] = time.split(":").map((n) => parseInt(n, 10));
  if (isNaN(h)) return "other";
  if (h >= 9 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 21) return "evening";
  return "other";
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso());

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
    // Sort by time ascending — values are already zero-padded "HH:MM"
    return [...list].sort((a, b) => a.requestedTime.localeCompare(b.requestedTime));
  })();

  const grouped = useMemo(() => {
    const emptyMethods = (): Record<MethodKey, Booking[]> => ({ home: [], self: [], unknown: [] });
    const map: Record<SlotKey, Record<MethodKey, Booking[]>> = {
      morning: emptyMethods(),
      afternoon: emptyMethods(),
      evening: emptyMethods(),
      other: emptyMethods(),
    };
    for (const b of filtered) map[slotOf(b.requestedTime)][methodOf(b.deliveryMethod)].push(b);
    return map;
  }, [filtered]);

  const slotTotal = (buckets: Record<MethodKey, Booking[]>) =>
    buckets.home.length + buckets.self.length + buckets.unknown.length;

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
        <div className="space-y-6">
          {SLOTS.map((slot) => {
            const buckets = grouped[slot.key];
            const total = slotTotal(buckets);
            if (total === 0) return null;
            return (
              <section key={slot.key}>
                <div className={`flex items-center justify-between gap-3 mb-3 px-3 py-2 rounded-lg border ${slot.accent}`}>
                  <div className="flex items-baseline gap-3">
                    <span className="text-base font-bold">{slot.label}</span>
                    <span className="text-xs opacity-75">{slot.range}</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70">
                    {total} คิว
                  </span>
                </div>

                {METHOD_GROUPS.map((mg) => {
                  const list = buckets[mg.key];
                  if (list.length === 0) return null;
                  return (
                    <div key={mg.key} className="mb-3 last:mb-0">
                      <div className={`flex items-center justify-between gap-3 mb-2 px-3 py-1.5 rounded-md border text-sm ${mg.accent}`}>
                        <div className="flex items-center gap-2">
                          <span>{mg.icon}</span>
                          <span className="font-semibold">{mg.label}</span>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70">
                          {list.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {list.map((b) => (
                          <div key={b.orderId} className="card">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xl font-bold text-blue-600 tabular-nums">{b.requestedTime}</span>
                                <span className="font-bold text-slate-500 text-sm">{b.orderId}</span>
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
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
