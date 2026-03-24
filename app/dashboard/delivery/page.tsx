"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Modal from "@/components/Modal";

interface DeliveryItem {
  name: string;
  qty: number;
  price: number;
}

interface DeliveryOrder {
  orderId: string;
  orderDbId: number;
  customer: string;
  phone: string;
  address: string;
  status: string;
  date: string;
  items: DeliveryItem[];
  totalAmount: number;
  photoUrl: string | null;
  deliveryId: number | null;
}

const filters = ["ทั้งหมด", "พร้อมส่ง", "ส่งแล้ว"];
const statusBadge: Record<string, string> = {
  "พร้อมส่ง": "badge-yellow",
  "ส่งแล้ว": "badge-green",
};

export default function DeliveryPage() {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ทั้งหมด");
  const [completeTarget, setCompleteTarget] = useState<DeliveryOrder | null>(null);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [viewPhotos, setViewPhotos] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDeliveries = useCallback(async () => {
    try {
      const res = await fetch("/api/deliveries");
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data);
      }
    } catch (error) {
      console.error("Failed to fetch deliveries:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const filtered =
    activeFilter === "ทั้งหมด"
      ? deliveries
      : deliveries.filter((d) => d.status === activeFilter);

  const openComplete = (d: DeliveryOrder) => {
    setCompleteTarget(d);
    setPhotoPreviews([]);
    setPhotoFiles([]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    setPhotoFiles((prev) => [...prev, ...newFiles]);

    for (const file of newFiles) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    if (!completeTarget || photoFiles.length === 0) return;
    setSubmitting(true);
    try {
      // Upload all photos
      const uploadedUrls: string[] = [];
      for (const file of photoFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          uploadedUrls.push(uploadData.url);
        }
      }

      if (uploadedUrls.length === 0) {
        alert("อัพโหลดรูปไม่สำเร็จ");
        return;
      }

      // Store as JSON array in photoUrl field
      const res = await fetch("/api/deliveries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: completeTarget.orderId,
          status: "ส่งแล้ว",
          photoUrl: JSON.stringify(uploadedUrls),
        }),
      });
      if (res.ok) {
        await fetchDeliveries();
        setCompleteTarget(null);
      }
    } catch (error) {
      console.error("Failed to complete delivery:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const openViewPhotos = (photoUrl: string | null) => {
    if (!photoUrl) return;
    try {
      const arr = JSON.parse(photoUrl);
      setViewPhotos(Array.isArray(arr) ? arr : [photoUrl]);
    } catch {
      setViewPhotos([photoUrl]);
    }
  };

  const calcQty = (items: DeliveryItem[]) =>
    items.reduce((s, i) => s + i.qty, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Delivery</h2>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
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

      {/* Mobile: Card Layout */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400">ไม่มีรายการ</div>
        ) : (
          filtered.map((d) => (
            <div key={d.orderId} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-blue-600 text-lg">{d.orderId}</span>
                <span className={`badge ${statusBadge[d.status] || "badge-gray"}`}>{d.status}</span>
              </div>
              <div className="text-sm text-slate-700 font-medium">{d.customer}</div>
              {d.phone && <div className="text-xs text-slate-400">{d.phone}</div>}
              <div className="text-xs text-slate-500 mt-1">{d.address}</div>
              <div className="text-xs text-slate-400 mt-1">{d.date} — {calcQty(d.items)} ชิ้น</div>
              <div className="text-xs text-slate-500 truncate mt-1">{d.items.map((i) => `${i.name}×${i.qty}`).join(", ")}</div>
              <div className="flex flex-wrap gap-2 pt-2 mt-2 border-t border-slate-100">
                {d.status === "พร้อมส่ง" && (
                  <button onClick={() => openComplete(d)} className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">ส่งเสร็จ</button>
                )}
                {d.status === "ส่งแล้ว" && d.photoUrl && (
                  <button onClick={() => openViewPhotos(d.photoUrl)} className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">ดูรูป</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: Table Layout */}
      <div className="card hidden sm:block">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขออเดอร์</th>
                <th>ชื่อลูกค้า</th>
                <th>ที่อยู่จัดส่ง</th>
                <th>รายการ</th>
                <th>สถานะ</th>
                <th>วันที่</th>
                <th className="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-slate-400 py-8">
                    ไม่มีรายการ
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.orderId}>
                    <td className="font-medium text-blue-600">{d.orderId}</td>
                    <td>
                      <div>{d.customer}</div>
                      {d.phone && (
                        <div className="text-xs text-slate-400">{d.phone}</div>
                      )}
                    </td>
                    <td className="text-slate-500">{d.address}</td>
                    <td className="text-slate-500">
                      <span className="text-xs">
                        {d.items.map((i) => i.name).join(", ")}
                      </span>
                      <div className="text-xs text-slate-400">
                        {calcQty(d.items)} ชิ้น
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${statusBadge[d.status] || "badge-gray"}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="text-slate-500">{d.date}</td>
                    <td className="text-center whitespace-nowrap">
                      {d.status === "พร้อมส่ง" && (
                        <button
                          onClick={() => openComplete(d)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          ส่งเสร็จ
                        </button>
                      )}
                      {d.status === "ส่งแล้ว" && d.photoUrl && (
                        <button
                          onClick={() => openViewPhotos(d.photoUrl)}
                          className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                        >
                          ดูรูป
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: แนบรูปเมื่อส่งเสร็จ */}
      <Modal
        isOpen={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        title="ยืนยันการส่งเสร็จ"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            ออเดอร์{" "}
            <span className="font-semibold text-blue-600">
              {completeTarget?.orderId}
            </span>{" "}
            — {completeTarget?.customer}
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              แนบรูปถ่ายหลักฐานการส่ง * (ถ่ายได้หลายรูป)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Photo previews grid */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {photoPreviews.map((preview, idx) => (
                  <div key={idx} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={`preview-${idx}`}
                      className="w-full h-24 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add photo button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              <svg
                className="w-6 h-6 mx-auto mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm">
                {photoPreviews.length > 0
                  ? `+ เพิ่มรูป (มี ${photoPreviews.length} รูป)`
                  : "ถ่ายรูป / เลือกรูป"}
              </span>
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setCompleteTarget(null)}
              className="flex-1 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleComplete}
              disabled={photoFiles.length === 0 || submitting}
              className="flex-1 btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "กำลังบันทึก..." : "ยืนยันส่งเสร็จ"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: ดูรูปหลักฐาน */}
      <Modal
        isOpen={!!viewPhotos}
        onClose={() => setViewPhotos(null)}
        title="รูปหลักฐานการส่ง"
      >
        {viewPhotos && (
          <div className="space-y-3">
            {viewPhotos.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={url}
                alt={`delivery-proof-${idx}`}
                className="w-full rounded-lg"
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
