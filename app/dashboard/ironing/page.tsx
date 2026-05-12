"use client";

import { useState, useEffect, useCallback } from "react";
import Pagination, { usePagination } from "@/components/Pagination";
import Modal from "@/components/Modal";
import Spinner from "@/components/Spinner";
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
  note: string;
}

const IRONED_TAG = "รีดโดย:";

export default function IroningPage() {
  const [orders, setOrders] = useState<IroningOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showStaffModal, setShowStaffModal] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

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

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.filter((u: { role: string; active: boolean }) => (u.role === "staff" || u.role === "ironer") && u.active));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchStaff();
  }, [fetchOrders, fetchStaff]);

  usePolling(fetchOrders, 30000);

  const filtered = (() => {
    let list = orders.filter(
      (o) => o.status === "รอซักรีด" && !(o.note || "").includes(IRONED_TAG)
    );
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

  const handleOpenStaffModal = (orderId: string) => {
    setShowStaffModal(orderId);
  };

  const handleSelectStaff = async (staffName: string) => {
    if (!showStaffModal) return;
    const order = orders.find((o) => o.orderId === showStaffModal);
    const existingNote = order?.note || "";
    const newNote = existingNote
      ? `${existingNote} | ${IRONED_TAG} ${staffName}`
      : `${IRONED_TAG} ${staffName}`;
    setSaving(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: showStaffModal,
          note: newNote,
        }),
      });
      if (res.ok) {
        await fetchOrders();
        setShowStaffModal(null);
      }
    } catch (error) {
      console.error("Failed to save ironing staff:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Ironing</h2>
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
        <div className="text-center py-12 text-slate-400">ไม่มีรายการรอรีด</div>
      ) : (
        <div className="space-y-4">
          {paged.map((o) => {
            const totalPieces = o.items.reduce((s, i) => s + i.qty, 0);

            return (
              <div key={o.orderId} className="card">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-blue-600 text-lg">{o.orderId}</span>
                    <span className="ml-2 text-slate-600">{o.customer}</span>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {o.items.length} รายการ ({totalPieces} ชิ้น)
                  </span>
                </div>

                {o.phone && (
                  <p className="text-xs text-slate-400 mb-2">โทร: {o.phone}</p>
                )}

                {/* Items list (display only) */}
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  {o.items.map((item, idx) => (
                    <div
                      key={`${o.orderId}-${idx}`}
                      className="flex items-center justify-between py-1.5 px-2 text-sm text-slate-700"
                    >
                      <span>{item.name}</span>
                      <span className="text-xs text-slate-400">x{item.qty}</span>
                    </div>
                  ))}
                </div>

                {/* Action button */}
                <div className="border-t border-slate-100 pt-3 mt-3">
                  <button
                    onClick={() => handleOpenStaffModal(o.orderId)}
                    disabled={saving}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {saving ? "กำลังบันทึก..." : "รีดเสร็จ — เลือกพนักงาน"}
                  </button>
                </div>
              </div>
            );
          })}
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={totalItems} itemsPerPage={itemsPerPage} />
        </div>
      )}

      {saving && <Spinner text="กำลังบันทึก..." />}

      {/* Modal: เลือกพนักงานรีด */}
      <Modal isOpen={!!showStaffModal} onClose={() => setShowStaffModal(null)} title="เลือกพนักงานรีด">
        <div className="space-y-2">
          <p className="text-sm text-slate-500 mb-3">ออเดอร์: <span className="font-bold text-blue-600">{showStaffModal}</span></p>
          {staffList.length === 0 ? (
            <p className="text-center text-slate-400 py-4">ไม่พบพนักงาน</p>
          ) : (
            staffList.map((staff) => (
              <button
                key={staff.id}
                onClick={() => handleSelectStaff(staff.name)}
                disabled={saving}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  {staff.name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-slate-700">{staff.name}</span>
              </button>
            ))
          )}
          <button
            onClick={() => setShowStaffModal(null)}
            className="w-full mt-2 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
        </div>
      </Modal>
    </div>
  );
}
