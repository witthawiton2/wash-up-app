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
};

const METHOD_LABELS: Record<string, string> = {
  home: "🏠 ฝากที่พัก",
  self: "🏪 รับเองที่ร้าน",
};

export default function DriverHome() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const [submitTarget, setSubmitTarget] = useState<Delivery | null>(null);
  const [submitPhoto, setSubmitPhoto] = useState<File | null>(null);
  const [submitPreview, setSubmitPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    setSubmitPhoto(null);
    setSubmitPreview("");
  };

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setSubmitPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submitComplete = async () => {
    if (!submitTarget) return;
    setSubmitting(true);
    try {
      let photoArray: string[] = [];
      if (submitPhoto) {
        const fd = new FormData();
        fd.append("file", submitPhoto);
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        if (up.ok) {
          const d = await up.json();
          if (d.success) photoArray = [d.url];
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
                  <button
                    onClick={() => openComplete(d)}
                    className="mt-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold"
                    style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                  >
                    📷 ถ่ายรูปปิดงาน
                  </button>
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

            {submitPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={submitPreview} alt="proof" className="w-full max-h-72 object-contain rounded-xl mb-3 border" />
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhotoChange} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400"
            >
              {submitPreview ? "เปลี่ยนรูป" : "📷 ถ่ายรูปเป็นหลักฐาน (ไม่บังคับ)"}
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
    </div>
  );
}
