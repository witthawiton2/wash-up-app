"use client";

import { useState, useEffect, useCallback } from "react";

const METHOD_LABELS: Record<string, string> = {
  cash: "เงินสด",
  qr_promptpay: "QR PromptPay",
  bank_transfer: "โอนธนาคาร",
  other: "อื่นๆ",
};

const METHOD_COLORS: Record<string, string> = {
  cash: "#10b981",
  qr_promptpay: "#3b82f6",
  bank_transfer: "#6366f1",
  other: "#94a3b8",
};

interface EodReport {
  date: string;
  count: number;
  grandTotal: number;
  byMethod: { method: string; count: number; total: number }[];
  orders: { orderId: string; amount: number; method: string; paidAt: string; customer: string }[];
}

const todayISO = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

export default function EodReportPage() {
  const [date, setDate] = useState(todayISO);
  const [report, setReport] = useState<EodReport | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/eod-cash?date=${date}`);
      if (res.ok) setReport(await res.json());
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePrint = () => window.print();

  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h2 className="text-2xl font-bold text-slate-800">สรุปยอดวันปิดร้าน</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
          />
          <button
            onClick={handlePrint}
            disabled={!report || report.count === 0}
            className="btn-primary disabled:opacity-50"
          >
            🖨 พิมพ์
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : !report || report.count === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">ไม่มีการชำระในวันนี้</p>
        </div>
      ) : (
        <>
          {/* Totals by method */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {report.byMethod.map((b) => (
              <div
                key={b.method}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
                style={{ borderLeftWidth: 4, borderLeftColor: METHOD_COLORS[b.method] || "#94a3b8" }}
              >
                <p className="text-xs text-slate-400 uppercase tracking-wider">
                  {METHOD_LABELS[b.method] || b.method}
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: METHOD_COLORS[b.method] || "#94a3b8" }}>
                  {b.total.toLocaleString()} ฿
                </p>
                <p className="text-xs text-slate-500 mt-1">{b.count} รายการ</p>
              </div>
            ))}
          </div>

          {/* Grand total */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">ยอดรวมวันที่ {report.date}</p>
              <p className="text-xs text-slate-400">{report.count} ออเดอร์</p>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {report.grandTotal.toLocaleString()} ฿
            </p>
          </div>

          {/* Order detail */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>ออเดอร์</th>
                  <th>ลูกค้า</th>
                  <th>วิธีชำระ</th>
                  <th className="text-right">ยอด</th>
                  <th className="text-right hide-mobile">เวลา</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((o) => (
                  <tr key={o.orderId}>
                    <td className="font-medium text-blue-600">{o.orderId}</td>
                    <td className="text-slate-700">{o.customer || "-"}</td>
                    <td>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: METHOD_COLORS[o.method] || "#94a3b8" }}
                      >
                        {METHOD_LABELS[o.method] || o.method}
                      </span>
                    </td>
                    <td className="text-right font-medium">{o.amount.toLocaleString()}</td>
                    <td className="text-right text-xs text-slate-400 hide-mobile">
                      {new Date(o.paidAt).toLocaleTimeString("th-TH", {
                        timeZone: "Asia/Bangkok",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
