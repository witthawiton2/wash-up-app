"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { googleMapsUrl } from "@/lib/maps";

interface Delivery {
  orderId: string;
  customer: string;
  phone: string;
  address: string;
  status: string;
  date: string;
  requestedAt: string | null;
  deliveryMethod: string | null;
  totalAmount: number;
  items: { name: string; qty: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  "พร้อมส่ง": "#10b981",
  "กำลังจัดส่ง": "#3b82f6",
  "ส่งแล้ว": "#94a3b8",
  "ส่งไม่สำเร็จ": "#ef4444",
};

const FAIL_REASONS = ["ลูกค้าไม่รับสาย", "ไม่อยู่บ้าน", "ที่อยู่ไม่ถูกต้อง", "อื่นๆ"];

const METHOD_LABELS: Record<string, string> = {
  home: "🏠 ฝากที่พัก",
  self: "🏪 รับเองที่ร้าน",
};

export default function DriverHome() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [submitTarget, setSubmitTarget] = useState<Delivery | null>(null);
  const [submitPhotos, setSubmitPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failTarget, setFailTarget] = useState<Delivery | null>(null);
  const [failReason, setFailReason] = useState("");
  const [failing, setFailing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/deliveries?days=7&booked=1");
      if (res.ok) setDeliveries(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = filter === "active"
    ? deliveries.filter((d) => d.status !== "ส่งแล้ว")
    : deliveries;

  const openComplete = (d: Delivery) => {
    setSubmitTarget(d);
    setSubmitPhotos([]);
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        setSubmitPhotos((prev) => [...prev, { file, preview: reader.result as string }]);
      reader.readAsDataURL(file);
    });
    // Allow re-picking the same file(s) again after removing.
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    setSubmitPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitComplete = async () => {
    if (!submitTarget) return;
    setSubmitting(true);
    try {
      const photoArray: string[] = [];
      for (const { file } of submitPhotos) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (up.ok) {
          const d = await up.json();
          if (d.success) photoArray.push(d.url);
        }
      }
      const res = await fetch("/api/deliveries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: submitTarget.orderId,
          status: "ส่งแล้ว",
          photoUrl: photoArray.length ? JSON.stringify(photoArray) : undefined,
        }),
      });
      if (res.ok) {
        setSubmitTarget(null);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openFail = (d: Delivery) => {
    setFailTarget(d);
    setFailReason("");
  };

  const markFailed = async () => {
    if (!failTarget || failing) return;
    setFailing(true);
    try {
      const res = await fetch("/api/deliveries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: failTarget.orderId,
          status: "ส่งไม่สำเร็จ",
          reason: failReason.trim() || undefined,
        }),
      });
      if (res.ok) {
        setFailTarget(null);
        await load();
      } else {
        alert("บันทึกไม่สำเร็จ กรุณาลองใหม่");
      }
    } catch {
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setFailing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">งานวันนี้</h1>
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setFilter("active")}
            className={`px-3 py-1.5 rounded-lg ${filter === "active" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
          >
            ค้างส่ง ({deliveries.filter((d) => d.status !== "ส่งแล้ว").length})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg ${filter === "all" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
          >
            ทั้งหมด
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-slate-500 font-medium">ไม่มีงานค้างส่ง</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const color = STATUS_COLORS[d.status] || "#94a3b8";
            return (
              <div key={d.orderId} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-slate-400">#{d.orderId}</p>
                    <p className="font-bold text-slate-800">{d.customer || "-"}</p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-1 rounded-full text-white uppercase tracking-wider"
                    style={{ backgroundColor: color }}
                  >
                    {d.status}
                  </span>
                </div>

                {(d.requestedAt || d.deliveryMethod) && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {d.requestedAt && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                        🗓 นัด: {d.requestedAt}
                      </span>
                    )}
                    {d.deliveryMethod && METHOD_LABELS[d.deliveryMethod] && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                        {METHOD_LABELS[d.deliveryMethod]}
                      </span>
                    )}
                  </div>
                )}

                {d.address && (
                  <div className="text-sm text-slate-600 mb-2">📍 {d.address}</div>
                )}

                <div className="text-xs text-slate-500 mb-3">
                  {d.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {d.phone && (
                    <a
                      href={`tel:${d.phone}`}
                      className="text-center py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100"
                    >
                      📞 {d.phone}
                    </a>
                  )}
                  {d.address && (
                    <a
                      href={googleMapsUrl(d.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100"
                    >
                      🗺 เปิดแผนที่
                    </a>
                  )}
                </div>

                {d.status !== "ส่งแล้ว" && (
                  <div className="mt-2 space-y-2">
                    <button
                      onClick={() => openComplete(d)}
                      className="w-full py-2.5 rounded-xl text-white text-sm font-semibold"
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                    >
                      📷 ถ่ายรูปปิดงาน
                    </button>
                    <button
                      onClick={() => openFail(d)}
                      className="w-full py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 border border-red-200 hover:bg-red-100"
                    >
                      ⚠️ ส่งไม่สำเร็จ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Complete modal */}
      {submitTarget && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-800">ยืนยันการส่ง</h3>
              <button onClick={() => setSubmitTarget(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-slate-500 mb-3">#{submitTarget.orderId} — {submitTarget.customer}</p>

            {submitPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {submitPhotos.map((p, idx) => (
                  <div key={idx} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={`proof-${idx}`} className="w-full h-24 object-cover rounded-lg border" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple onChange={onPhotoChange} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400"
            >
              {submitPhotos.length > 0 ? `📷 เพิ่มรูป (${submitPhotos.length} รูป)` : "📷 ถ่ายรูปเป็นหลักฐาน (ไม่บังคับ)"}
            </button>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSubmitTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={submitComplete}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              >
                {submitting ? "กำลังบันทึก..." : "ยืนยันส่งแล้ว"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failed-delivery modal */}
      {failTarget && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-800">ส่งไม่สำเร็จ</h3>
              <button onClick={() => setFailTarget(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-slate-500 mb-3">#{failTarget.orderId} — {failTarget.customer}</p>

            <p className="text-sm font-medium text-slate-600 mb-2">เลือกเหตุผล</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {FAIL_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setFailReason(r === "อื่นๆ" ? "" : r)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    failReason === r
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-white text-slate-600 border-slate-300 hover:border-red-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="ระบุเหตุผลเพิ่มเติม (ถ้ามี)"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setFailTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={markFailed}
                disabled={failing}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 bg-red-500 hover:bg-red-600"
              >
                {failing ? "กำลังบันทึก..." : "ยืนยันส่งไม่สำเร็จ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
