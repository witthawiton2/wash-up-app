"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import liff from "@line/liff";
import { useLang, type Lang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api-client";
import LanguageToggle from "@/components/LanguageToggle";

const STR: Record<Lang, Record<string, string>> = {
  th: {
    loading: "กำลังโหลด...",
    err_load: "ไม่สามารถโหลดข้อมูลได้",
    back: "← กลับ",
    order: "ออเดอร์",
    order_date: "วันที่สั่ง",
    items: "รายการ",
    qty_short: "x",
    subtotal: "ยอดรวมก่อนลด",
    discount: "ส่วนลด",
    hangers_bought: "ไม้แขวนที่ซื้อ",
    total: "ยอดรวมทั้งหมด",
    booked_for: "วันนัดรับ-ส่ง",
    delivery_address: "ที่อยู่จัดส่ง",
    delivery_date: "วันที่จัดส่ง",
    delivery_photos: "รูปจัดส่ง",
    view_photos: "📷 ดูรูปจัดส่ง",
    payment: "การชำระเงิน",
    paid_ok: "ชำระเงินเรียบร้อยแล้ว",
    slip_sent: "ส่งสลิปแล้ว — รอตรวจสอบ",
    not_paid: "ยังไม่ชำระ",
    view_slip: "ดูสลิปที่ส่ง",
    view_receipt: "🧾 ดูใบเสร็จ",
    status_washing: "กำลังซัก",
    status_ready: "พร้อมส่ง",
    status_delivered: "ส่งแล้ว",
    delivery_photo_title: "รูปจัดส่ง",
    close: "ปิด",
    note: "หมายเหตุ",
  },
  en: {
    loading: "Loading...",
    err_load: "Could not load data",
    back: "← Back",
    order: "Order",
    order_date: "Order date",
    items: "Items",
    qty_short: "x",
    subtotal: "Subtotal",
    discount: "Discount",
    hangers_bought: "Hangers purchased",
    total: "Total",
    booked_for: "Pickup / delivery on",
    delivery_address: "Delivery address",
    delivery_date: "Delivery date",
    delivery_photos: "Delivery photos",
    view_photos: "📷 View delivery photos",
    payment: "Payment",
    paid_ok: "Payment confirmed",
    slip_sent: "Slip submitted — under review",
    not_paid: "Unpaid",
    view_slip: "View submitted slip",
    view_receipt: "🧾 View receipt",
    status_washing: "Washing",
    status_ready: "Ready",
    status_delivered: "Delivered",
    delivery_photo_title: "Delivery photo",
    close: "Close",
    note: "Note",
  },
};

interface OrderItem {
  name: string;
  nameEn: string | null;
  qty: number;
  price: number;
}

interface OrderDetail {
  orderId: string;
  status: string;
  orderDate: string;
  requestedDeliveryDate: string | null;
  items: OrderItem[];
  totalAmount: number;
  discount: number;
  hangersOwned: number;
  hangersBought: number;
  note: string | null;
  paymentStatus: string;
  paymentSlipUrl: string | null;
  customer: { name: string; phone: string; address: string };
  delivery: {
    status: string;
    address: string | null;
    date: string | null;
    photos: string[];
  } | null;
}

const statusColor: Record<string, string> = {
  "รอซักรีด": "#3b82f6",
  "พร้อมส่ง": "#10b981",
  "ส่งแล้ว": "#94a3b8",
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const lang = useLang();
  const s = STR[lang];
  const statusLabel: Record<string, string> = {
    "รอซักรีด": s.status_washing,
    "พร้อมส่ง": s.status_ready,
    "ส่งแล้ว": s.status_delivered,
  };

  const [lineUserId, setLineUserId] = useState("");
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photoViewUrls, setPhotoViewUrls] = useState<string[] | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const receiptLoading = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testUid = params.get("testUserId");
    if (testUid) {
      setLineUserId(testUid);
      loadOrder(testUid);
      return;
    }

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setError("LIFF ID not configured");
      setLoading(false);
      return;
    }

    liff
      .init({ liffId })
      .then(() => {
        if (liff.isLoggedIn()) {
          liff.getProfile().then((profile) => {
            setLineUserId(profile.userId);
            loadOrder(profile.userId);
          });
        } else {
          liff.login();
        }
      })
      .catch(() => {
        setError(s.err_load);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrder = async (uid: string) => {
    try {
      const res = await apiFetch(
        `/api/my/orders/${orderId}?lineUserId=${encodeURIComponent(uid)}`,
      );
      if (res.ok) {
        setOrder(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || s.err_load);
      }
    } catch {
      setError(s.err_load);
    } finally {
      setLoading(false);
    }
  };

  const openReceipt = async () => {
    if (!lineUserId || receiptLoading.current) return;
    receiptLoading.current = true;
    try {
      const res = await apiFetch(
        `/api/my/receipt-token?lineUserId=${encodeURIComponent(lineUserId)}&orderId=${encodeURIComponent(orderId)}`,
      );
      if (res.ok) {
        const { sig } = await res.json();
        setReceiptUrl(`/api/receipt/${orderId}?sig=${sig}&t=${Date.now()}`);
      }
    } finally {
      receiptLoading.current = false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg, #0c1222, #1a2744, #2563eb)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-300/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/80 text-sm">{s.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #0c1222, #1a2744, #2563eb)" }}>
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
          <div className="text-5xl mb-3">😕</div>
          <p className="text-slate-600 font-medium mb-4">{error || s.err_load}</p>
          <Link href="/my" className="inline-block px-6 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}>
            {s.back}
          </Link>
        </div>
      </div>
    );
  }

  const stColor = statusColor[order.status] || "#94a3b8";
  const stText = statusLabel[order.status] || order.status;

  const itemsSubtotal = order.items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const hangersSubtotal = order.hangersBought * 5;
  const grossSubtotal = itemsSubtotal + hangersSubtotal;
  const discountAmount = order.discount > 0
    ? Math.round((grossSubtotal * order.discount) / 100 * 100) / 100
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #f0f4ff 0%, #f8fafc 100%)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div className="text-white px-4 pt-6 pb-8 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0c1222 0%, #1a2744 40%, #2563eb 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3), transparent)" }} />
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <Link href="/my" className="text-sm font-medium text-white/90 hover:text-white">
              {s.back}
            </Link>
            <LanguageToggle variant="dark" />
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-blue-300/70 text-xs uppercase tracking-wider">{s.order}</p>
              <h1 className="text-2xl font-bold mt-1">{order.orderId}</h1>
              <p className="text-blue-200/80 text-xs mt-1">{order.orderDate}</p>
            </div>
            <span
              className="text-[10px] font-semibold px-3 py-1.5 rounded-full uppercase tracking-wider"
              style={{ backgroundColor: stColor }}
            >
              {stText}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 -mt-4 space-y-3 relative z-10">
        {/* Items */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 mb-3">{s.items}</h2>
          <div className="space-y-2">
            {order.items.map((item, i) => {
              const name = lang === "en" && item.nameEn ? item.nameEn : item.name;
              return (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700">
                    {name} <span className="text-slate-400">{s.qty_short}{item.qty}</span>
                  </span>
                  <span className="text-slate-600 font-medium">
                    {(item.qty * item.price).toLocaleString()}฿
                  </span>
                </div>
              );
            })}
            {order.hangersBought > 0 && (
              <div className="flex justify-between text-sm pt-1">
                <span className="text-slate-700">
                  {s.hangers_bought} <span className="text-slate-400">{s.qty_short}{order.hangersBought}</span>
                </span>
                <span className="text-slate-600 font-medium">{hangersSubtotal.toLocaleString()}฿</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 mt-3 pt-3 space-y-1 text-sm">
            {order.discount > 0 && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>{s.subtotal}</span>
                  <span>{grossSubtotal.toLocaleString()}฿</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>{s.discount} ({order.discount}%)</span>
                  <span>-{discountAmount.toLocaleString()}฿</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-400 uppercase tracking-wider">{s.total}</span>
              <span className="text-xl font-bold" style={{ color: "#2563eb" }}>
                {order.totalAmount.toLocaleString()} ฿
              </span>
            </div>
          </div>
        </div>

        {/* Booking / delivery */}
        {(order.requestedDeliveryDate || order.delivery) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 mb-3">{s.booked_for}</h2>
            {order.requestedDeliveryDate && (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-2">
                📅 {order.requestedDeliveryDate}
              </p>
            )}
            {order.delivery?.address && (
              <p className="text-sm text-slate-600 mb-1">
                <span className="text-slate-400">{s.delivery_address}: </span>{order.delivery.address}
              </p>
            )}
            {order.delivery?.date && (
              <p className="text-sm text-slate-600 mb-2">
                <span className="text-slate-400">{s.delivery_date}: </span>{order.delivery.date}
              </p>
            )}
            {order.delivery && order.delivery.photos.length > 0 && (
              <button
                onClick={() => setPhotoViewUrls(order.delivery!.photos)}
                className="mt-2 w-full flex items-center justify-center gap-2 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
              >
                <span className="font-medium">{s.view_photos}</span>
              </button>
            )}
          </div>
        )}

        {/* Payment */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <h2 className="text-sm font-bold text-slate-700 mb-3">{s.payment}</h2>
          {order.paymentStatus === "paid" ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
              <span>✅</span>
              <span className="font-medium">{s.paid_ok}</span>
            </div>
          ) : order.paymentStatus === "pending" ? (
            <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
              <span>⏳</span>
              <span className="font-medium">{s.slip_sent}</span>
            </div>
          ) : (
            <div className="text-sm text-slate-500 px-1">{s.not_paid}</div>
          )}
          {order.paymentSlipUrl && (
            <a
              href={order.paymentSlipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-700 underline"
            >
              {s.view_slip}
            </a>
          )}
        </div>

        {/* Note */}
        {order.note && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h2 className="text-sm font-bold text-slate-700 mb-2">{s.note}</h2>
            <p className="text-sm text-slate-600 whitespace-pre-line">{order.note}</p>
          </div>
        )}

        {/* Receipt button */}
        <button
          onClick={openReceipt}
          className="w-full py-3 rounded-2xl text-white text-sm font-semibold shadow-sm hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}
        >
          {s.view_receipt}
        </button>
      </div>

      {/* Delivery photo viewer */}
      {photoViewUrls && photoViewUrls.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setPhotoViewUrls(null)}
        >
          <div className="relative max-w-md w-full my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 text-white">
              <h3 className="text-base font-bold">{s.delivery_photo_title}</h3>
              <button onClick={() => setPhotoViewUrls(null)} className="text-white/80 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="space-y-3">
              {photoViewUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`delivery ${i + 1}`} className="w-full max-h-[75vh] object-contain rounded-xl bg-white" />
              ))}
            </div>
            <button
              onClick={() => setPhotoViewUrls(null)}
              className="mt-3 w-full py-2.5 rounded-xl bg-white/90 text-sm font-medium text-slate-700 hover:bg-white"
            >
              {s.close}
            </button>
          </div>
        </div>
      )}

      {/* Receipt image viewer */}
      {receiptUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setReceiptUrl(null)}
        >
          <div className="relative max-w-md w-full my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 text-white">
              <h3 className="text-base font-bold">{s.view_receipt}</h3>
              <button onClick={() => setReceiptUrl(null)} className="text-white/80 hover:text-white text-2xl leading-none">✕</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptUrl} alt="receipt" className="w-full max-h-[80vh] object-contain rounded-xl bg-white" />
            <button
              onClick={() => setReceiptUrl(null)}
              className="mt-3 w-full py-2.5 rounded-xl bg-white/90 text-sm font-medium text-slate-700 hover:bg-white"
            >
              {s.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
