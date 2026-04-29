"use client";

import { useState, useEffect, useCallback } from "react";
import Spinner from "@/components/Spinner";

interface Payment {
  orderId: string;
  customer: string;
  phone: string;
  totalAmount: number;
  paymentSlipUrl: string | null;
  paymentStatus: string;
  orderDate: string;
  status: string;
  items: { name: string; qty: number; price: number }[];
}

const filters = ["ทั้งหมด", "รอตรวจสอบ", "ยังไม่ชำระ"];

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ทั้งหมด");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewSlip, setViewSlip] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ orderId: string; action: string } | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch("/api/payments");
      if (res.ok) setPayments(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    const interval = setInterval(fetchPayments, 30000);
    return () => clearInterval(interval);
  }, [fetchPayments]);

  const handleAction = async (orderId: string, action: "confirm" | "reject") => {
    setSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action }),
      });
      if (res.ok) {
        await fetchPayments();
        setConfirmTarget(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const filtered = (() => {
    let list = payments;
    if (activeFilter === "รอตรวจสอบ") list = payments.filter((p) => p.paymentStatus === "pending");
    else if (activeFilter === "ยังไม่ชำระ") list = payments.filter((p) => p.paymentStatus === "unpaid");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) =>
        p.orderId.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        (p.phone || "").includes(q)
      );
    }
    return list;
  })();

  const pendingCount = payments.filter((p) => p.paymentStatus === "pending").length;
  const unpaidCount = payments.filter((p) => p.paymentStatus === "unpaid").length;

  return (
    <div>
      {saving && <Spinner text="กำลังบันทึก..." />}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">ตรวจสอบการชำระ</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card">
          <p className="text-xs text-slate-500">รอตรวจสอบ</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{pendingCount}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">ยังไม่ชำระ</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{unpaidCount}</p>
        </div>
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
        placeholder="ค้นหา เลขออเดอร์ / ชื่อลูกค้า / เบอร์โทร..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">ไม่มีรายการ</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.orderId} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-bold text-blue-600 text-lg">{p.orderId}</span>
                  <p className="text-sm text-slate-700 mt-0.5">{p.customer}</p>
                  <p className="text-xs text-slate-400">{p.phone || "-"}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase ${
                  p.paymentStatus === "pending" ? "bg-orange-100 text-orange-700"
                  : p.paymentStatus === "paid" ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
                }`}>
                  {p.paymentStatus === "pending" ? "รอตรวจสอบ" : p.paymentStatus === "paid" ? "ชำระแล้ว" : "ยังไม่ชำระ"}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2 mb-3">
                <span className="text-xs text-slate-500">ยอดรวม</span>
                <span className="text-base font-bold text-blue-600">{p.totalAmount.toLocaleString()} ฿</span>
              </div>

              <p className="text-xs text-slate-400 mb-3">วันที่: {p.orderDate}</p>

              <div className="flex flex-wrap gap-2">
                {p.paymentSlipUrl && (
                  <button
                    onClick={() => setViewSlip(p.paymentSlipUrl!)}
                    className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100"
                  >
                    📄 ดูสลิป
                  </button>
                )}
                {p.paymentStatus === "pending" && (
                  <>
                    <button
                      onClick={() => setConfirmTarget({ orderId: p.orderId, action: "confirm" })}
                      className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                    >
                      ✅ ยืนยันชำระแล้ว
                    </button>
                    <button
                      onClick={() => setConfirmTarget({ orderId: p.orderId, action: "reject" })}
                      className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100"
                    >
                      ❌ ปฏิเสธ
                    </button>
                  </>
                )}
                {p.paymentStatus === "unpaid" && (
                  <button
                    onClick={() => setConfirmTarget({ orderId: p.orderId, action: "confirm" })}
                    className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
                  >
                    ✅ บันทึกชำระเงินสด
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Slip Modal */}
      {viewSlip && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setViewSlip(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewSlip} alt="Payment slip" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Confirm Modal */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <p className="text-center mb-4 text-slate-700">
              {confirmTarget.action === "confirm"
                ? `ยืนยันการชำระเงินสำหรับออเดอร์ ${confirmTarget.orderId}?`
                : `ปฏิเสธสลิปและให้ลูกค้าส่งใหม่?`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmTarget(null)} className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600">
                ยกเลิก
              </button>
              <button
                onClick={() => handleAction(confirmTarget.orderId, confirmTarget.action as "confirm" | "reject")}
                className="flex-1 btn-primary py-2.5"
                style={confirmTarget.action === "reject" ? { background: "linear-gradient(135deg, #ef4444, #dc2626)" } : {}}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
