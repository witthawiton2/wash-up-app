"use client";

import { useState, useEffect, useRef } from "react";
import liff from "@line/liff";

interface CustomerInfo {
  id: number;
  name: string;
  phone: string;
  package: string;
  remaining: number;
  endDate: string | null;
  customerCode: string;
}

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface MyOrder {
  orderId: string;
  items: OrderItem[];
  status: string;
  totalAmount: number;
  date: string;
  requestedDeliveryDate: string | null;
  paymentStatus: string;
  paymentSlipUrl: string | null;
}

interface PackageOption {
  id: number;
  name: string;
  description: string;
  totalItems: number;
  validDays: number;
  price: number;
}

const statusLabel: Record<string, { text: string; color: string }> = {
  "รอซักรีด": { text: "กำลังซัก", color: "#3b82f6" },
  "พร้อมส่ง": { text: "พร้อมส่ง", color: "#10b981" },
  "ส่งแล้ว": { text: "ส่งแล้ว", color: "#94a3b8" },
};

type Tab = "orders" | "package" | "booking";

export default function MyPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Package renewal
  const [selectedPkg, setSelectedPkg] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState("");
  const [renewLoading, setRenewLoading] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState(false);
  const slipRef = useRef<HTMLInputElement>(null);

  // Booking
  const [bookingActivity, setBookingActivity] = useState("");
  const [bookingOrderId, setBookingOrderId] = useState("");
  const [bookingTimeSlot, setBookingTimeSlot] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [bookingDeliveryMethod, setBookingDeliveryMethod] = useState<"" | "self" | "home">("");

  // Payment slip upload
  const [payOrderId, setPayOrderId] = useState<string | null>(null);
  const [paySlipFile, setPaySlipFile] = useState<File | null>(null);
  const [paySlipPreview, setPaySlipPreview] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const paySlipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Auto-select tab from query param ?tab=booking
    const tabParam = params.get("tab");
    if (tabParam === "booking" || tabParam === "package" || tabParam === "orders") {
      setActiveTab(tabParam as Tab);
    }

    // Dev mode: skip LIFF login with ?testUserId=xxx
    const testUid = params.get("testUserId");
    if (testUid) {
      setLineUserId(testUid);
      loadData(testUid);
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
            loadData(profile.userId);
          });
        } else {
          liff.login();
        }
      })
      .catch(() => {
        setError("ไม่สามารถเชื่อมต่อ LINE ได้");
        setLoading(false);
      });
  }, []);

  const loadData = async (uid: string) => {
    try {
      const [custRes, ordersRes, pkgRes] = await Promise.all([
        fetch(`/api/renew?lineUserId=${uid}`),
        fetch(`/api/my/orders?lineUserId=${uid}`),
        fetch("/api/packages"),
      ]);

      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomer(custData);
      }
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        setPackages(pkgData);
      }
    } catch {
      setError("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPkg = async (pkgName: string) => {
    setSelectedPkg(pkgName);
    setRenewSuccess(false);
    const pkg = packages.find((p) => p.name === pkgName);
    if (pkg && pkg.price > 0) {
      try {
        const res = await fetch("/api/promptpay-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: pkg.price }),
        });
        if (res.ok) {
          const data = await res.json();
          setQrUrl(data.qrDataUri);
        }
      } catch { /* ignore */ }
    }
  };

  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlipFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setSlipPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRenew = async () => {
    if (!selectedPkg || !slipFile || !lineUserId) return;
    setRenewLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", slipFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        alert("อัพโหลดสลิปไม่สำเร็จ");
        return;
      }

      const res = await fetch("/api/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          package: selectedPkg,
          slipUrl: uploadData.url,
        }),
      });
      if (res.ok) {
        setRenewSuccess(true);
        setSlipFile(null);
        setSlipPreview("");
        setQrUrl("");
        loadData(lineUserId);
        setTimeout(() => {
          setActiveTab("orders");
          setRenewSuccess(false);
        }, 1500);
      }
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setRenewLoading(false);
    }
  };

  const timeSlots: Record<string, string[]> = {
    "ช่วงเช้า (9:00-12:00)": ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"],
    "ช่วงบ่าย (12:00-18:00)": ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
    "ช่วงเย็น (18:00-20:30)": ["18:00", "18:30", "19:00", "19:30", "20:00"],
  };

  const activities = [
    { id: "send", label: "ส่งเสื้อผ้าซัก" },
    { id: "receive", label: "รับเสื้อผ้าที่เสร็จคืน (+ส่งเสื้อผ้าใหม่)" },
  ];

  const handleSlipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPaySlipFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPaySlipPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const openPayModal = (orderId: string) => {
    setPayOrderId(orderId);
    setPaySlipFile(null);
    setPaySlipPreview("");
  };

  const handleUploadPayment = async () => {
    if (!payOrderId || !paySlipFile || !lineUserId) return;
    setPayLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", paySlipFile);
      const upRes = await fetch("/api/upload", { method: "POST", body: formData });
      const upData = await upRes.json();
      if (!upData.success) {
        alert("อัพโหลดสลิปไม่สำเร็จ");
        return;
      }
      const res = await fetch("/api/my/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, orderId: payOrderId, slipUrl: upData.url }),
      });
      if (res.ok) {
        setPayOrderId(null);
        setPaySlipFile(null);
        setPaySlipPreview("");
        loadData(lineUserId);
      }
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setPayLoading(false);
    }
  };

  const handleCancelBooking = async (orderId: string) => {
    if (!lineUserId) return;
    if (!confirm(`ยกเลิกคิวของออเดอร์ ${orderId}?`)) return;
    setCancellingOrderId(orderId);
    try {
      const res = await fetch(
        `/api/my/booking?lineUserId=${encodeURIComponent(lineUserId)}&orderId=${encodeURIComponent(orderId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        loadData(lineUserId);
      } else {
        alert("ยกเลิกคิวไม่สำเร็จ");
      }
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleBooking = async () => {
    if (!bookingActivity || !bookingDate || !bookingTime || !bookingDeliveryMethod || !lineUserId) return;
    setBookingLoading(true);
    try {
      const res = await fetch("/api/my/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          activity: bookingActivity,
          orderId: bookingOrderId || undefined,
          date: bookingDate,
          time: bookingTime,
          deliveryMethod: bookingDeliveryMethod,
          phone: bookingPhone || customer?.phone,
          note: bookingNote,
        }),
      });
      if (res.ok) {
        setBookingSuccess(true);
        setBookingActivity("");
        setBookingOrderId("");
        setBookingTimeSlot("");
        setBookingDate("");
        setBookingTime("");
        setBookingDeliveryMethod("");
        setBookingNote("");
      }
    } catch {
      alert("เกิดข้อผิดพลาด");
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg, #0c1222, #1a2744, #2563eb)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-300/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/80 text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #0c1222, #1a2744, #2563eb)" }}>
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl border border-white/20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <p className="text-slate-600 font-medium">{error || "ไม่พบข้อมูลลูกค้า"}</p>
          <a href="/register" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}>ลงทะเบียนใหม่</a>
        </div>
      </div>
    );
  }

  const pkg = packages.find((p) => p.name === selectedPkg);
  const pendingOrders = orders.filter((o) => o.status !== "ส่งแล้ว");

  return (
    <div className="min-h-screen pb-20" style={{ background: "linear-gradient(180deg, #f0f4ff 0%, #f8fafc 100%)" }}>
      {/* Header */}
      <div className="text-white px-4 pt-8 pb-10 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0c1222 0%, #1a2744 40%, #2563eb 100%)" }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3), transparent)" }} />
        <div className="absolute -bottom-20 -left-10 w-60 h-60 rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.2), transparent)" }} />

        <div className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Wash Up" className="h-12 mx-auto mb-4 brightness-0 invert opacity-90" />

          {/* Customer Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ background: "linear-gradient(135deg, #6366f1, #3b82f6)" }}>
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate">{customer.customerCode ? `${customer.customerCode} ` : ""}{customer.name}</p>
                <p className="text-blue-300/70 text-xs">{customer.phone || "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-blue-300/60 uppercase tracking-wider">แพ็คเกจ</p>
                <p className="font-bold text-lg mt-0.5">{customer.package || "-"}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-blue-300/60 uppercase tracking-wider">คงเหลือ</p>
                <p className={`font-bold text-lg mt-0.5 ${customer.remaining <= 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {customer.remaining}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-blue-300/60 uppercase tracking-wider">หมดอายุ</p>
                <p className="font-bold text-xs mt-1.5">{customer.endDate || "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 relative z-10">
        {/* Tab: Orders */}
        {activeTab === "orders" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-full bg-blue-500" />
                <h3 className="text-base font-bold text-slate-800">รายการของฉัน</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{orders.length} รายการ</span>
            </div>
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-400 text-sm">ยังไม่มีรายการ</p>
              </div>
            ) : (
              orders.map((o) => {
                const st = statusLabel[o.status] || { text: o.status, color: "#94a3b8" };
                return (
                  <div key={o.orderId} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${st.color}, ${st.color}cc)` }}>
                          {o.orderId.slice(-2)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{o.orderId}</span>
                          <p className="text-[10px] text-slate-400">{o.date}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full text-white uppercase tracking-wider" style={{ backgroundColor: st.color }}>
                        {st.text}
                      </span>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {o.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-600">{item.name} <span className="text-slate-400">x{item.qty}</span></span>
                          <span className="text-slate-500 font-medium">{(item.qty * item.price).toLocaleString()}฿</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-400">ยอดรวม</span>
                      <span className="text-base font-bold" style={{ color: "#2563eb" }}>{o.totalAmount.toLocaleString()} ฿</span>
                    </div>
                    {o.requestedDeliveryDate && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1.5">
                        <span>📅</span>
                        <span>จองส่งวันที่: {o.requestedDeliveryDate}</span>
                      </div>
                    )}

                    {/* Payment status */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      {o.paymentStatus === "paid" ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                          <span>✅</span>
                          <span className="font-medium">ชำระเงินเรียบร้อยแล้ว</span>
                        </div>
                      ) : o.paymentStatus === "pending" ? (
                        <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
                          <span>⏳</span>
                          <span className="font-medium">ส่งสลิปแล้ว — รอตรวจสอบ</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => openPayModal(o.orderId)}
                          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}
                        >
                          💳 อัพโหลดสลิปการชำระ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab: Package */}
        {activeTab === "package" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-full bg-purple-500" />
              <h3 className="text-base font-bold text-slate-800">เติมแพ็คเกจ</h3>
            </div>

            {renewSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-center text-sm">
                ส่งคำขอเติมแพ็คเกจสำเร็จ รอแอดมินยืนยัน
              </div>
            )}

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-slate-600 mb-2">เลือกแพ็คเกจ</label>
              <select
                value={selectedPkg}
                onChange={(e) => handleSelectPkg(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- เลือกแพ็คเกจ --</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} — {p.totalItems} ชิ้น / {p.validDays} วัน ({p.price.toLocaleString()}฿)
                  </option>
                ))}
              </select>

              {pkg && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                  {pkg.description && <p className="text-slate-500">{pkg.description}</p>}
                  <p className="text-blue-700 font-medium">จำนวน: {pkg.totalItems} ชิ้น</p>
                  <p className="text-blue-700 font-medium">อายุ: {pkg.validDays} วัน</p>
                  <p className="text-blue-700 font-bold text-base">ราคา: {pkg.price.toLocaleString()}฿</p>
                </div>
              )}
            </div>

            {qrUrl && (
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-sm font-medium text-slate-600 mb-3">สแกน QR ชำระเงิน</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="PromptPay QR" className="mx-auto w-48 h-48 rounded-lg" />
                <p className="text-xs text-slate-400 mt-2">PromptPay</p>
              </div>
            )}

            {selectedPkg && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-600 mb-2">แนบสลิปการโอนเงิน</p>
                {slipPreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slipPreview} alt="slip" className="w-full max-h-60 object-contain rounded-lg mb-3" />
                )}
                <input ref={slipRef} type="file" accept="image/*" capture="environment" onChange={handleSlipChange} className="hidden" />
                <button
                  onClick={() => slipRef.current?.click()}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400"
                >
                  {slipPreview ? "เปลี่ยนรูปสลิป" : "ถ่ายรูป / เลือกรูปสลิป"}
                </button>

                <button
                  onClick={handleRenew}
                  disabled={!slipFile || renewLoading}
                  className="w-full mt-3 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)" }}
                >
                  {renewLoading ? "กำลังส่ง..." : "ส่งคำขอเติมแพ็คเกจ"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Booking */}
        {activeTab === "booking" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-full bg-emerald-500" />
              <h3 className="text-base font-bold text-slate-800">จองคิว</h3>
            </div>

            {bookingSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-center text-sm">
                จองคิวสำเร็จ รอการยืนยันจากร้าน
              </div>
            )}

            {/* คิวที่จองไว้ (history + cancel) */}
            {orders.some((o) => o.requestedDeliveryDate) && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">คิวที่จองไว้</h4>
                <div className="space-y-2">
                  {orders
                    .filter((o) => o.requestedDeliveryDate)
                    .map((o) => (
                      <div
                        key={o.orderId}
                        className="flex items-center justify-between gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-blue-600">{o.orderId}</div>
                          <div className="text-xs text-emerald-700">📅 {o.requestedDeliveryDate}</div>
                        </div>
                        <button
                          onClick={() => handleCancelBooking(o.orderId)}
                          disabled={cancellingOrderId === o.orderId}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50"
                        >
                          {cancellingOrderId === o.orderId ? "กำลังยกเลิก..." : "ยกเลิกคิว"}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* เลือกกิจกรรม */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h4 className="text-sm font-bold text-slate-700 mb-3">เลือกกิจกรรม</h4>
              <div className="space-y-2">
                {activities.map((a) => (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      bookingActivity === a.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-blue-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="activity"
                      value={a.id}
                      checked={bookingActivity === a.id}
                      onChange={() => { setBookingActivity(a.id); setBookingSuccess(false); }}
                      className="w-5 h-5 text-blue-500"
                    />
                    <span className="text-sm text-slate-700">{a.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* เลือกออเดอร์ (เฉพาะรับผ้าคืน) */}
            {bookingActivity === "receive" && pendingOrders.length > 0 && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">เลือกออเดอร์ที่ต้องการรับคืน</h4>
                <div className="space-y-2">
                  {pendingOrders.map((o) => (
                    <label
                      key={o.orderId}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        bookingOrderId === o.orderId
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="bookingOrder"
                        value={o.orderId}
                        checked={bookingOrderId === o.orderId}
                        onChange={() => setBookingOrderId(o.orderId)}
                        className="w-5 h-5 text-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-blue-600">{o.orderId}</span>
                        <span className="text-xs text-slate-400 ml-2">{o.date}</span>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* เลือกช่วงเวลา */}
            {bookingActivity && (bookingActivity === "send" || bookingOrderId || pendingOrders.length === 0) && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">เลือกช่วงเวลา</h4>
                <div className="space-y-2">
                  {Object.keys(timeSlots).map((slot) => (
                    <label
                      key={slot}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        bookingTimeSlot === slot
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="timeSlot"
                        value={slot}
                        checked={bookingTimeSlot === slot}
                        onChange={() => { setBookingTimeSlot(slot); setBookingTime(""); }}
                        className="w-5 h-5 text-blue-500"
                      />
                      <span className="text-sm text-slate-700">{slot}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* เลือกวันที่ */}
            {bookingTimeSlot && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">เลือกวันที่</h4>
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* เลือกเวลา */}
            {bookingDate && bookingTimeSlot && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">เลือกเวลา</h4>
                <div className="flex flex-wrap gap-2">
                  {timeSlots[bookingTimeSlot]?.map((t) => (
                    <button
                      key={t}
                      onClick={() => setBookingTime(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        bookingTime === t
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* วิธีรับ-ส่งผ้า */}
            {bookingTime && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">วิธีรับ-ส่งผ้า</h4>
                <div className="space-y-2">
                  {[
                    { id: "self" as const, label: "รับด้วยตัวเอง", desc: "มาที่ร้าน" },
                    { id: "home" as const, label: "ฝากที่พัก", desc: "ร้านไปรับ/ส่งที่บ้าน" },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        bookingDeliveryMethod === m.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        value={m.id}
                        checked={bookingDeliveryMethod === m.id}
                        onChange={() => setBookingDeliveryMethod(m.id)}
                        className="w-5 h-5 text-blue-500"
                      />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{m.label}</div>
                        <div className="text-[11px] text-slate-400">{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* เบอร์โทร + หมายเหตุ */}
            {bookingTime && bookingDeliveryMethod && (
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-2">เบอร์โทรติดต่อ</h4>
                  <input
                    type="tel"
                    value={bookingPhone || customer?.phone || ""}
                    onChange={(e) => setBookingPhone(e.target.value)}
                    placeholder="0812345678"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-2">หมายเหตุ <span className="font-normal text-slate-400">(เว้นว่างได้)</span></h4>
                  <textarea
                    value={bookingNote}
                    onChange={(e) => setBookingNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleBooking}
                  disabled={bookingLoading}
                  className="w-full py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)" }}
                >
                  {bookingLoading ? "กำลังจอง..." : "จอง"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Upload Modal */}
      {payOrderId && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">อัพโหลดสลิปการชำระ</h3>
              <button onClick={() => setPayOrderId(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">ออเดอร์: <span className="font-bold text-blue-600">{payOrderId}</span></p>

            {paySlipPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={paySlipPreview} alt="slip" className="w-full max-h-72 object-contain rounded-xl mb-3 border" />
            )}
            <input ref={paySlipRef} type="file" accept="image/*" capture="environment" onChange={handleSlipFileChange} className="hidden" />
            <button
              onClick={() => paySlipRef.current?.click()}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              {paySlipPreview ? "เปลี่ยนรูปสลิป" : "📷 ถ่ายรูป / เลือกรูปสลิป"}
            </button>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setPayOrderId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUploadPayment}
                disabled={!paySlipFile || payLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}
              >
                {payLoading ? "กำลังส่ง..." : "ส่งสลิป"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/50 flex safe-area-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {([
          { key: "orders" as Tab, label: "รายการ", icon: "📋" },
          { key: "package" as Tab, label: "แพ็คเกจ", icon: "📦" },
          { key: "booking" as Tab, label: "จองคิว", icon: "📅" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-all duration-200 ${
              activeTab === tab.key ? "text-blue-600" : "text-slate-400"
            }`}
          >
            <div className={`text-lg transition-transform duration-200 ${activeTab === tab.key ? "scale-110" : ""}`}>{tab.icon}</div>
            <span className={`text-[10px] ${activeTab === tab.key ? "font-bold" : "font-medium"}`}>{tab.label}</span>
            {activeTab === tab.key && (
              <div className="w-5 h-0.5 rounded-full bg-blue-600 mt-0.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
