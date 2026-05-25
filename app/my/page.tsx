"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSettings } from "@/lib/settings-context";
import { useLang, type Lang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api-client";
import LanguageToggle from "@/components/LanguageToggle";
import liff from "@line/liff";

const STR: Record<Lang, Record<string, string>> = {
  th: {
    loading: "กำลังโหลด...",
    no_customer: "ไม่พบข้อมูลลูกค้า",
    register_new: "ลงทะเบียนใหม่",
    err_line: "ไม่สามารถเชื่อมต่อ LINE ได้",
    err_load: "ไม่สามารถโหลดข้อมูลได้",
    pkg_short: "แพ็คเกจ",
    remaining_short: "คงเหลือ",
    expiry_short: "หมดอายุ",
    status_washing: "กำลังซัก",
    status_ready: "พร้อมส่ง",
    status_delivered: "ส่งแล้ว",
    my_items: "รายการของฉัน",
    n_items: "{n} รายการ",
    no_items_yet: "ยังไม่มีรายการ",
    total: "ยอดรวม",
    booked_for: "จองส่งวันที่:",
    paid_ok: "ชำระเงินเรียบร้อยแล้ว",
    slip_sent: "ส่งสลิปแล้ว — รอตรวจสอบ",
    upload_payment: "💳 อัพโหลดสลิปการชำระ",
    top_up_package: "เติมแพ็คเกจ",
    renew_submitted_msg: "ส่งคำขอเติมแพ็คเกจสำเร็จ รอแอดมินยืนยัน",
    waiting_admin: "รอแอดมินอนุมัติ",
    waiting_admin_msg_l1: "คำขอเติมแพ็คเกจของคุณส่งให้ร้านแล้ว",
    waiting_admin_msg_l2: "รอแอดมินตรวจสอบสลิปและยืนยัน 😊",
    select_package: "เลือกแพ็คเกจ",
    select_pkg_placeholder: "-- เลือกแพ็คเกจ --",
    pkg_option: "{name} — {items} ชิ้น / {days} วัน ({price}฿)",
    qty_n: "จำนวน: {n} ชิ้น",
    validity_n: "อายุ: {n} วัน",
    price_baht: "ราคา: {n}฿",
    qr_scan: "สแกน QR ชำระเงิน",
    attach_slip: "แนบสลิปการโอนเงิน",
    pick_slip: "ถ่ายรูป / เลือกรูปสลิป",
    change_slip: "เปลี่ยนรูปสลิป",
    sending: "กำลังส่ง...",
    submit_renew: "ส่งคำขอเติมแพ็คเกจ",
    booking: "จองคิว",
    booking_success: "จองคิวสำเร็จ รอการยืนยันจากร้าน",
    booked_queue: "คิวที่จองไว้",
    cancel_queue: "ยกเลิกคิว",
    cancelling: "กำลังยกเลิก...",
    choose_activity: "เลือกกิจกรรม",
    act_send: "ส่งเสื้อผ้าซัก",
    act_receive: "รับเสื้อผ้าที่เสร็จคืน (+ส่งเสื้อผ้าใหม่)",
    choose_order_receive: "เลือกออเดอร์ที่ต้องการรับคืน",
    choose_timeslot: "เลือกช่วงเวลา",
    slot_morning: "ช่วงเช้า (9:00-12:00)",
    slot_afternoon: "ช่วงบ่าย (12:00-18:00)",
    slot_evening: "ช่วงเย็น (18:00-20:30)",
    choose_date: "เลือกวันที่",
    choose_time: "เลือกเวลา",
    pickup_method: "วิธีรับ-ส่งผ้า",
    method_self_title: "รับด้วยตัวเอง",
    method_self_desc: "มาที่ร้าน",
    method_home_title: "ฝากที่พัก",
    method_home_desc: "ร้านไปรับ/ส่งที่บ้าน",
    phone_contact: "เบอร์โทรติดต่อ",
    note_label: "หมายเหตุ",
    note_optional: "(เว้นว่างได้)",
    submit_booking: "จอง",
    booking_loading: "กำลังจอง...",
    upload_slip_title: "อัพโหลดสลิปการชำระ",
    order_label: "ออเดอร์:",
    submit_slip: "ส่งสลิป",
    cancel: "ยกเลิก",
    pick_slip_modal: "📷 ถ่ายรูป / เลือกรูปสลิป",
    tab_orders: "รายการ",
    tab_package: "แพ็คเกจ",
    tab_booking: "จองคิว",
    confirm_cancel: "ยกเลิกคิวของออเดอร์ {orderId}?",
    cancel_failed: "ยกเลิกคิวไม่สำเร็จ",
    err_generic: "เกิดข้อผิดพลาด",
    upload_failed: "อัพโหลดสลิปไม่สำเร็จ",
    view_delivery_photo: "ดูรูปจัดส่ง",
    delivery_photo_title: "รูปจัดส่ง",
    close: "ปิด",
  },
  en: {
    loading: "Loading...",
    no_customer: "Customer not found",
    register_new: "Register",
    err_line: "Could not connect to LINE",
    err_load: "Could not load data",
    pkg_short: "Package",
    remaining_short: "Remaining",
    expiry_short: "Expires",
    status_washing: "Washing",
    status_ready: "Ready",
    status_delivered: "Delivered",
    my_items: "My orders",
    n_items: "{n} orders",
    no_items_yet: "No orders yet",
    total: "Total",
    booked_for: "Booked for:",
    paid_ok: "Payment confirmed",
    slip_sent: "Slip submitted — waiting for review",
    upload_payment: "💳 Upload payment slip",
    top_up_package: "Top up package",
    renew_submitted_msg: "Renewal request submitted — waiting for admin",
    waiting_admin: "Waiting for admin",
    waiting_admin_msg_l1: "Your renewal request has been sent to the shop.",
    waiting_admin_msg_l2: "The admin will review the slip and confirm 😊",
    select_package: "Select package",
    select_pkg_placeholder: "-- Select package --",
    pkg_option: "{name} — {items} items / {days} days ({price}฿)",
    qty_n: "Items: {n}",
    validity_n: "Validity: {n} days",
    price_baht: "Price: {n}฿",
    qr_scan: "Scan QR to pay",
    attach_slip: "Attach transfer slip",
    pick_slip: "Take photo / select slip",
    change_slip: "Change slip",
    sending: "Sending...",
    submit_renew: "Submit renewal request",
    booking: "Book a slot",
    booking_success: "Booking submitted — waiting for shop confirmation",
    booked_queue: "Your bookings",
    cancel_queue: "Cancel booking",
    cancelling: "Cancelling...",
    choose_activity: "Choose activity",
    act_send: "Drop off laundry",
    act_receive: "Pick up finished (+drop off new)",
    choose_order_receive: "Select an order to pick up",
    choose_timeslot: "Choose time slot",
    slot_morning: "Morning (9:00-12:00)",
    slot_afternoon: "Afternoon (12:00-18:00)",
    slot_evening: "Evening (18:00-20:30)",
    choose_date: "Choose date",
    choose_time: "Choose time",
    pickup_method: "Pickup / delivery method",
    method_self_title: "I'll come myself",
    method_self_desc: "At the shop",
    method_home_title: "At my place",
    method_home_desc: "Shop picks up / drops off at my place",
    phone_contact: "Contact phone",
    note_label: "Note",
    note_optional: "(optional)",
    submit_booking: "Book",
    booking_loading: "Booking...",
    upload_slip_title: "Upload payment slip",
    order_label: "Order:",
    submit_slip: "Send slip",
    cancel: "Cancel",
    pick_slip_modal: "📷 Take photo / select slip",
    tab_orders: "Orders",
    tab_package: "Package",
    tab_booking: "Booking",
    confirm_cancel: "Cancel booking for {orderId}?",
    cancel_failed: "Could not cancel booking",
    err_generic: "Something went wrong",
    upload_failed: "Slip upload failed",
    view_delivery_photo: "View delivery photo",
    delivery_photo_title: "Delivery photo",
    close: "Close",
  },
};

const fmt = (str: string, vars: Record<string, string | number>) =>
  str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

interface CustomerInfo {
  id: number;
  name: string;
  phone: string;
  package: string;
  remaining: number;
  endDate: string | null;
  customerCode: string;
  renewPending: boolean;
}

interface OrderItem {
  name: string;
  nameEn: string | null;
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
  deliveryPhotos: string[];
}

interface PackageOption {
  id: number;
  name: string;
  description: string;
  totalItems: number;
  validDays: number;
  price: number;
}

const statusColor: Record<string, string> = {
  "รอซักรีด": "#3b82f6",
  "พร้อมส่ง": "#10b981",
  "ส่งแล้ว": "#94a3b8",
};

type Tab = "orders" | "package" | "booking";

export default function MyPage() {
  const { settings } = useSettings();
  const lang = useLang();
  const s = STR[lang];
  const statusLabel: Record<string, { text: string; color: string }> = {
    "รอซักรีด": { text: s.status_washing, color: statusColor["รอซักรีด"] },
    "พร้อมส่ง": { text: s.status_ready, color: statusColor["พร้อมส่ง"] },
    "ส่งแล้ว": { text: s.status_delivered, color: statusColor["ส่งแล้ว"] },
  };
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

  // Delivery photo viewer
  const [photoViewUrls, setPhotoViewUrls] = useState<string[] | null>(null);

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
        setError(s.err_line);
        setLoading(false);
      });
  }, []);

  const loadData = async (uid: string) => {
    try {
      const [custRes, ordersRes, pkgRes] = await Promise.all([
        apiFetch(`/api/renew?lineUserId=${uid}`),
        apiFetch(`/api/my/orders?lineUserId=${uid}`),
        apiFetch("/api/packages"),
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
      setError(s.err_load);
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
        const res = await apiFetch(`/api/promptpay-qr?amount=${pkg.price}`);
        if (res.ok) {
          const data = await res.json();
          setQrUrl(data.qr);
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
      const uploadRes = await apiFetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        alert(uploadData.error || s.upload_failed);
        return;
      }

      const res = await apiFetch("/api/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          packageName: selectedPkg,
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
      alert(s.err_generic);
    } finally {
      setRenewLoading(false);
    }
  };

  // Slot keys are stable internal ids; labels resolve via the dict so the
  // selected slot stays selected when the user flips language mid-flow.
  const SLOT_IDS = ["morning", "afternoon", "evening"] as const;
  const slotLabels: Record<string, string> = {
    morning: s.slot_morning,
    afternoon: s.slot_afternoon,
    evening: s.slot_evening,
  };
  const slotTimes: Record<string, string[]> = {
    morning: ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30"],
    afternoon: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"],
    evening: ["18:00", "18:30", "19:00", "19:30", "20:00"],
  };

  const activities = [
    { id: "send", label: s.act_send },
    { id: "receive", label: s.act_receive },
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
      const upRes = await apiFetch("/api/upload", { method: "POST", body: formData });
      const upData = await upRes.json();
      if (!upData.success) {
        alert(upData.error || s.upload_failed);
        return;
      }
      const res = await apiFetch("/api/my/payment", {
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
      alert(s.err_generic);
    } finally {
      setPayLoading(false);
    }
  };

  const handleCancelBooking = async (orderId: string) => {
    if (!lineUserId) return;
    if (!confirm(fmt(s.confirm_cancel, { orderId }))) return;
    setCancellingOrderId(orderId);
    try {
      const res = await apiFetch(
        `/api/my/booking?lineUserId=${encodeURIComponent(lineUserId)}&orderId=${encodeURIComponent(orderId)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        loadData(lineUserId);
      } else {
        alert(s.cancel_failed);
      }
    } catch {
      alert(s.err_generic);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const handleBooking = async () => {
    if (!bookingActivity || !bookingDate || !bookingTime || !bookingDeliveryMethod || !lineUserId) return;
    setBookingLoading(true);
    try {
      const res = await apiFetch("/api/my/booking", {
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
      alert(s.err_generic);
    } finally {
      setBookingLoading(false);
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

  if (error || !customer) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #0c1222, #1a2744, #2563eb)" }}>
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl border border-white/20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <p className="text-slate-600 font-medium">{error || s.no_customer}</p>
          <a href="/register" className="inline-block mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-medium" style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}>{s.register_new}</a>
        </div>
      </div>
    );
  }

  const pkg = packages.find((p) => p.name === selectedPkg);
  const pendingOrders = orders.filter(
    (o) => o.status !== "ส่งแล้ว" && !o.requestedDeliveryDate
  );

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #f0f4ff 0%, #f8fafc 100%)", paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
      {/* Header */}
      <div className="text-white px-4 pt-8 pb-10 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0c1222 0%, #1a2744 40%, #2563eb 100%)" }}>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full" style={{ background: "radial-gradient(circle, rgba(99,102,241,0.3), transparent)" }} />
        <div className="absolute -bottom-20 -left-10 w-60 h-60 rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.2), transparent)" }} />

        <div className="relative z-10">
          <div className="flex justify-end mb-2">
            <LanguageToggle variant="dark" />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settings.logoUrl || "/images/logo.png"}
            alt={settings.companyName || "Wash Up"}
            className={`h-16 mx-auto mb-4 object-contain ${settings.logoUrl ? "" : "brightness-0 invert opacity-90"}`}
          />

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
                <p className="text-[10px] text-blue-300/60 uppercase tracking-wider">{s.pkg_short}</p>
                <p className="font-bold text-lg mt-0.5">{customer.package || "-"}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-blue-300/60 uppercase tracking-wider">{s.remaining_short}</p>
                <p className={`font-bold text-lg mt-0.5 ${customer.remaining <= 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {customer.remaining}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-blue-300/60 uppercase tracking-wider">{s.expiry_short}</p>
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
                <h3 className="text-base font-bold text-slate-800">{s.my_items}</h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{fmt(s.n_items, { n: orders.length })}</span>
            </div>
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-400 text-sm">{s.no_items_yet}</p>
              </div>
            ) : (
              orders.map((o) => {
                const st = statusLabel[o.status] || { text: o.status, color: "#94a3b8" };
                return (
                  <Link
                    key={o.orderId}
                    href={`/my/orders/${o.orderId}`}
                    className="block bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                  >
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
                      {o.items.map((item, idx) => {
                        const displayName = lang === "en" && item.nameEn ? item.nameEn : item.name;
                        return (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-slate-600">{displayName} <span className="text-slate-400">x{item.qty}</span></span>
                            <span className="text-slate-500 font-medium">{(item.qty * item.price).toLocaleString()}฿</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-400">{s.total}</span>
                      <span className="text-base font-bold" style={{ color: "#2563eb" }}>{o.totalAmount.toLocaleString()} ฿</span>
                    </div>
                    {o.requestedDeliveryDate && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1.5">
                        <span>📅</span>
                        <span>{s.booked_for} {o.requestedDeliveryDate}</span>
                      </div>
                    )}
                    {o.deliveryPhotos.length > 0 && (
                      <button
                        onClick={(e) => { e.preventDefault(); setPhotoViewUrls(o.deliveryPhotos); }}
                        className="mt-2 w-full flex items-center justify-center gap-2 text-xs text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 transition-colors"
                      >
                        <span>📷</span>
                        <span className="font-medium">{s.view_delivery_photo}</span>
                      </button>
                    )}

                    {/* Payment status */}
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      {o.paymentStatus === "paid" ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                          <span>✅</span>
                          <span className="font-medium">{s.paid_ok}</span>
                        </div>
                      ) : o.paymentStatus === "pending" ? (
                        <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 rounded-lg px-3 py-2 border border-orange-200">
                          <span>⏳</span>
                          <span className="font-medium">{s.slip_sent}</span>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); openPayModal(o.orderId); }}
                          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
                          style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}
                        >
                          {s.upload_payment}
                        </button>
                      )}
                    </div>
                  </Link>
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
              <h3 className="text-base font-bold text-slate-800">{s.top_up_package}</h3>
            </div>

            {renewSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-center text-sm">
                {s.renew_submitted_msg}
              </div>
            )}

            {customer?.renewPending ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
                <div className="text-3xl mb-2">⏳</div>
                <p className="text-amber-800 font-bold text-base mb-1">{s.waiting_admin}</p>
                <p className="text-amber-700 text-sm">
                  {s.waiting_admin_msg_l1}<br />
                  {s.waiting_admin_msg_l2}
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <label className="block text-sm font-medium text-slate-600 mb-2">{s.select_package}</label>
                  <select
                    value={selectedPkg}
                    onChange={(e) => handleSelectPkg(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{s.select_pkg_placeholder}</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.name}>
                        {fmt(s.pkg_option, { name: p.name, items: p.totalItems, days: p.validDays, price: p.price.toLocaleString() })}
                      </option>
                    ))}
                  </select>

                  {pkg && (
                    <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                      {pkg.description && <p className="text-slate-500">{pkg.description}</p>}
                      <p className="text-blue-700 font-medium">{fmt(s.qty_n, { n: pkg.totalItems })}</p>
                      <p className="text-blue-700 font-medium">{fmt(s.validity_n, { n: pkg.validDays })}</p>
                      <p className="text-blue-700 font-bold text-base">{fmt(s.price_baht, { n: pkg.price.toLocaleString() })}</p>
                    </div>
                  )}
                </div>

                {qrUrl && (
                  <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                    <p className="text-sm font-medium text-slate-600 mb-3">{s.qr_scan}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="PromptPay QR" className="mx-auto w-48 h-48 rounded-lg" />
                    <p className="text-xs text-slate-400 mt-2">PromptPay</p>
                  </div>
                )}

                {selectedPkg && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm font-medium text-slate-600 mb-2">{s.attach_slip}</p>
                    {slipPreview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slipPreview} alt="slip" className="w-full max-h-60 object-contain rounded-lg mb-3" />
                    )}
                    <input ref={slipRef} type="file" accept="image/*" capture="environment" onChange={handleSlipChange} className="hidden" />
                    <button
                      onClick={() => slipRef.current?.click()}
                      className="w-full py-2.5 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400"
                    >
                      {slipPreview ? s.change_slip : s.pick_slip}
                    </button>

                    <button
                      onClick={handleRenew}
                      disabled={!slipFile || renewLoading}
                      className="w-full mt-3 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)" }}
                    >
                      {renewLoading ? s.sending : s.submit_renew}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: Booking */}
        {activeTab === "booking" && (
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-5 rounded-full bg-emerald-500" />
              <h3 className="text-base font-bold text-slate-800">{s.booking}</h3>
            </div>

            {bookingSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-4 text-center text-sm">
                {s.booking_success}
              </div>
            )}

            {/* คิวที่จองไว้ (history + cancel) — ยกเว้นออเดอร์ที่ส่งแล้ว */}
            {orders.some((o) => o.requestedDeliveryDate && o.status !== "ส่งแล้ว") && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">{s.booked_queue}</h4>
                <div className="space-y-2">
                  {orders
                    .filter((o) => o.requestedDeliveryDate && o.status !== "ส่งแล้ว")
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
                          {cancellingOrderId === o.orderId ? s.cancelling : s.cancel_queue}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* เลือกกิจกรรม */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h4 className="text-sm font-bold text-slate-700 mb-3">{s.choose_activity}</h4>
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
                <h4 className="text-sm font-bold text-slate-700 mb-3">{s.choose_order_receive}</h4>
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
                          {o.items.map((i) => `${lang === "en" && i.nameEn ? i.nameEn : i.name} x${i.qty}`).join(", ")}
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
                <h4 className="text-sm font-bold text-slate-700 mb-3">{s.choose_timeslot}</h4>
                <div className="space-y-2">
                  {SLOT_IDS.map((slot) => (
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
                      <span className="text-sm text-slate-700">{slotLabels[slot]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* เลือกวันที่ */}
            {bookingTimeSlot && (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h4 className="text-sm font-bold text-slate-700 mb-3">{s.choose_date}</h4>
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
                <h4 className="text-sm font-bold text-slate-700 mb-3">{s.choose_time}</h4>
                <div className="flex flex-wrap gap-2">
                  {slotTimes[bookingTimeSlot]?.map((t) => (
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
                <h4 className="text-sm font-bold text-slate-700 mb-3">{s.pickup_method}</h4>
                <div className="space-y-2">
                  {[
                    { id: "self" as const, label: s.method_self_title, desc: s.method_self_desc },
                    { id: "home" as const, label: s.method_home_title, desc: s.method_home_desc },
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
                  <h4 className="text-sm font-bold text-slate-700 mb-2">{s.phone_contact}</h4>
                  <input
                    type="tel"
                    value={bookingPhone || customer?.phone || ""}
                    onChange={(e) => setBookingPhone(e.target.value)}
                    placeholder="0812345678"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 mb-2">{s.note_label} <span className="font-normal text-slate-400">{s.note_optional}</span></h4>
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
                  {bookingLoading ? s.booking_loading : s.submit_booking}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delivery Photo Viewer */}
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

      {/* Payment Upload Modal */}
      {payOrderId && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">{s.upload_slip_title}</h3>
              <button onClick={() => setPayOrderId(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-slate-500 mb-4">{s.order_label} <span className="font-bold text-blue-600">{payOrderId}</span></p>

            {paySlipPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={paySlipPreview} alt="slip" className="w-full max-h-72 object-contain rounded-xl mb-3 border" />
            )}
            <input ref={paySlipRef} type="file" accept="image/*" capture="environment" onChange={handleSlipFileChange} className="hidden" />
            <button
              onClick={() => paySlipRef.current?.click()}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              {paySlipPreview ? s.change_slip : s.pick_slip_modal}
            </button>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setPayOrderId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {s.cancel}
              </button>
              <button
                onClick={handleUploadPayment}
                disabled={!paySlipFile || payLoading}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}
              >
                {payLoading ? s.sending : s.submit_slip}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200/50 flex safe-area-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.04)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {([
          { key: "orders" as Tab, label: s.tab_orders, icon: "📋" },
          { key: "package" as Tab, label: s.tab_package, icon: "📦" },
          { key: "booking" as Tab, label: s.tab_booking, icon: "📅" },
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
