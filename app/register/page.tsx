"use client";

import { useState, useEffect } from "react";
import liff from "@line/liff";
import { useSettings } from "@/lib/settings-context";
import { useLang, type Lang } from "@/lib/i18n";
import LanguageToggle from "@/components/LanguageToggle";

interface PackageOption {
  id: number;
  name: string;
  description: string;
  totalItems: number;
  validDays: number;
  price: number;
}

interface ExistingCustomer {
  id: number;
  name: string;
  phone: string;
  package: string;
  remaining: number;
  endDate: string;
  renewPending: boolean;
}

const STR: Record<Lang, Record<string, string>> = {
  th: {
    loading: "กำลังโหลด...",
    register_success: "ลงทะเบียนสำเร็จ!",
    renew_success: "ส่งคำขอเติมแพ็คเกจแล้ว!",
    register_thanks: "ขอบคุณที่สมัครสมาชิก Wash Up",
    renew_wait: "รอแอดมินยืนยัน จะได้รับแจ้งเตือนทาง LINE",
    title_register: "Register",
    title_renew: "Renew Package",
    pkg_label: "แพ็คเกจ:",
    remaining_n: "เหลือ {n} ชิ้น",
    expiry: "หมดอายุ:",
    already_pending: "⏳ มีคำขอเติมแพ็คเกจรออยู่แล้ว กรุณารอแอดมินยืนยัน",
    select_renew_pkg: "เลือกแพ็คเกจที่ต้องการเติม",
    select_pkg_placeholder: "-- เลือกแพ็คเกจ --",
    pkg_option: "{name} — {items} ชิ้น / {days} วัน ({price}฿)",
    qty_plus: "จำนวน: +{n} ชิ้น",
    qty_n: "จำนวน: {n} ชิ้น",
    price_baht: "ราคา: {n} ฿",
    expiry_full: "หมดอายุ: {date} ({n} วัน)",
    pay_via_promptpay: "ชำระเงินผ่าน PromptPay",
    kbank: "กสิกร",
    attach_slip: "แนบสลิปการโอนเงิน",
    err_generic: "เกิดข้อผิดพลาด",
    sending: "กำลังส่ง...",
    submit_renew: "ส่งคำขอเติมแพ็คเกจ",
    first_name: "ชื่อ",
    last_name: "นามสกุล",
    phone: "เบอร์โทรศัพท์",
    address: "ที่อยู่",
    package: "แพ็คเกจ",
    email: "Email",
    optional: "(ไม่บังคับ)",
    ph_first_name: "กรอกชื่อ",
    ph_last_name: "กรอกนามสกุล",
    ph_address: "กรอกที่อยู่สำหรับจัดส่ง",
    err_select_pkg: "กรุณาเลือกแพ็คเกจ",
    registering: "กำลังลงทะเบียน...",
    submit_register: "ลงทะเบียน",
  },
  en: {
    loading: "Loading...",
    register_success: "Registration successful!",
    renew_success: "Renewal request submitted!",
    register_thanks: "Thank you for signing up with Wash Up",
    renew_wait: "Waiting for admin confirmation — you'll be notified on LINE",
    title_register: "Register",
    title_renew: "Renew Package",
    pkg_label: "Package:",
    remaining_n: "{n} items left",
    expiry: "Expires:",
    already_pending: "⏳ A renewal request is already pending admin approval",
    select_renew_pkg: "Select a package to renew",
    select_pkg_placeholder: "-- Select package --",
    pkg_option: "{name} — {items} items / {days} days ({price}฿)",
    qty_plus: "Quantity: +{n} items",
    qty_n: "Quantity: {n} items",
    price_baht: "Price: {n} ฿",
    expiry_full: "Expires: {date} ({n} days)",
    pay_via_promptpay: "Pay via PromptPay",
    kbank: "Kasikorn",
    attach_slip: "Attach transfer slip",
    err_generic: "Something went wrong",
    sending: "Sending...",
    submit_renew: "Submit renewal request",
    first_name: "First name",
    last_name: "Last name",
    phone: "Phone",
    address: "Address",
    package: "Package",
    email: "Email",
    optional: "(optional)",
    ph_first_name: "Enter first name",
    ph_last_name: "Enter last name",
    ph_address: "Delivery address",
    err_select_pkg: "Please select a package",
    registering: "Registering...",
    submit_register: "Register",
  },
};

const fmt = (str: string, vars: Record<string, string | number>) =>
  str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export default function RegisterPage() {
  const { settings } = useSettings();
  const lang = useLang();
  const s = STR[lang];
  const [lineUserId, setLineUserId] = useState("");
  const [mode, setMode] = useState<"loading" | "register" | "renew">("loading");
  const [existingCustomer, setExistingCustomer] = useState<ExistingCustomer | null>(null);

  // Register fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  // Shared
  const [packageType, setPackageType] = useState("");
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [qrData, setQrData] = useState<{ qr: string; account: string; name: string } | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetch("/api/packages")
      .then((res) => res.json())
      .then((data) => setPackages(data))
      .catch(() => {});

    // Dev mode: skip LIFF login with ?testUserId=xxx
    const params = new URLSearchParams(window.location.search);
    const testUid = params.get("testUserId");
    if (testUid) {
      setLineUserId(testUid);
      checkExistingCustomer(testUid);
      return;
    }

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setMode("register");
      return;
    }

    liff
      .init({ liffId })
      .then(() => {
        if (liff.isLoggedIn()) {
          liff.getProfile().then((profile) => {
            setLineUserId(profile.userId);
            checkExistingCustomer(profile.userId);
          });
        } else {
          liff.login();
        }
      })
      .catch(() => {
        setMode("register");
      });
  }, []);

  const checkExistingCustomer = async (uid: string) => {
    try {
      const res = await fetch(`/api/renew?lineUserId=${uid}`);
      if (res.ok) {
        // Existing customer → redirect to customer portal
        window.location.href = "/my";
        return;
      } else {
        setMode("register");
      }
    } catch {
      setMode("register");
    }
  };

  const handleSelectPackage = async (pkgName: string) => {
    setPackageType(pkgName);
    setQrData(null);
    if (mode === "renew") {
      const pkg = packages.find((p) => p.name === pkgName);
      if (pkg && pkg.price > 0) {
        try {
          const res = await fetch(`/api/promptpay-qr?amount=${pkg.price}`);
          if (res.ok) setQrData(await res.json());
        } catch { /* */ }
      }
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!packageType) { setError(s.err_select_pkg); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone, address, package: packageType, email, lineUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMessage(s.register_success);
      setSuccess(true);
      setTimeout(() => { try { if (liff.isInClient()) liff.closeWindow(); } catch { /* */ } }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.err_generic);
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!packageType) { setError(s.err_select_pkg); return; }
    setLoading(true);
    try {
      let slipUrl = "";
      if (slipFile) {
        const formData = new FormData();
        formData.append("file", slipFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.success) slipUrl = uploadData.url;
      }
      const res = await fetch("/api/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, packageName: packageType, slipUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMessage(s.renew_success);
      setSuccess(true);
      setTimeout(() => { try { if (liff.isInClient()) liff.closeWindow(); } catch { /* */ } }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : s.err_generic);
    } finally {
      setLoading(false);
    }
  };

  const pkg = packages.find((p) => p.name === packageType);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(160deg, #0c1222, #1a2744, #2563eb)" }}>
        <div className="w-full max-w-md text-center">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{successMessage}</h2>
            <p className="text-slate-500 text-sm">
              {mode === "renew" ? s.renew_wait : s.register_thanks}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg, #0c1222, #1a2744, #2563eb)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-300/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/80 text-sm">{s.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: "linear-gradient(160deg, #0c1222 0%, #1a2744 40%, #2563eb 100%)" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <LanguageToggle variant="dark" />
        </div>
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settings.logoUrl || "/images/logo.png"}
            alt={settings.companyName || "Wash Up"}
            className={`h-20 mx-auto mb-2 object-contain ${settings.logoUrl ? "" : "brightness-0 invert opacity-90"}`}
          />
          <p className="text-blue-300/60 text-xs tracking-widest uppercase">{mode === "renew" ? s.title_renew : s.title_register}</p>
        </div>

        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-white/20">
          {/* RENEW MODE */}
          {mode === "renew" && existingCustomer && (
            <form onSubmit={handleRenew} className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">{existingCustomer.name}</p>
                <p className="text-xs text-slate-400">{existingCustomer.phone}</p>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-slate-500">{s.pkg_label} <span className="font-medium text-blue-600">{existingCustomer.package || "-"}</span></span>
                  <span className={`font-medium ${existingCustomer.remaining <= 0 ? "text-red-500" : "text-green-600"}`}>{fmt(s.remaining_n, { n: existingCustomer.remaining })}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{s.expiry} {existingCustomer.endDate}</p>
              </div>

              {existingCustomer.renewPending && (
                <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">{s.already_pending}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{s.select_renew_pkg}</label>
                <select value={packageType} onChange={(e) => handleSelectPackage(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" required disabled={existingCustomer.renewPending}>
                  <option value="">{s.select_pkg_placeholder}</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.name}>{fmt(s.pkg_option, { name: p.name, items: p.totalItems, days: p.validDays, price: p.price.toLocaleString() })}</option>
                  ))}
                </select>
                {pkg && (
                  <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2 text-xs space-y-1">
                    {pkg.description && <p className="text-slate-500">{pkg.description}</p>}
                    <p className="text-purple-700 font-medium">{fmt(s.qty_plus, { n: pkg.totalItems })}</p>
                    <p className="text-purple-700 font-bold text-base">{fmt(s.price_baht, { n: pkg.price.toLocaleString() })}</p>
                  </div>
                )}
              </div>

              {qrData && pkg && (
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-slate-700">{s.pay_via_promptpay}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrData.qr} alt="QR" className="mx-auto w-48 h-48 rounded-lg" />
                  <p className="text-sm font-bold">{qrData.account} {s.kbank}</p>
                  <p className="text-sm font-medium">{qrData.name}</p>
                  <p className="text-lg font-bold text-green-600">{pkg.price.toLocaleString()} ฿</p>
                </div>
              )}

              {packageType && !existingCustomer.renewPending && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{s.attach_slip}</label>
                  <input type="file" accept="image/*" capture="environment" onChange={handleSlipChange} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700" />
                  {slipPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slipPreview} alt="slip" className="mt-2 w-full max-h-48 object-contain rounded-lg border" />
                  )}
                </div>
              )}

              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>}

              {!existingCustomer.renewPending && (
                <button type="submit" disabled={loading || !packageType} className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)" }}>
                  {loading ? s.sending : s.submit_renew}
                </button>
              )}
            </form>
          )}

          {/* REGISTER MODE */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{s.first_name} <span className="text-red-500">*</span></label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder={s.ph_first_name} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{s.last_name} <span className="text-red-500">*</span></label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder={s.ph_last_name} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{s.phone} <span className="text-red-500">*</span></label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="0812345678" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{s.address} <span className="text-red-500">*</span></label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder={s.ph_address} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{s.package} <span className="text-red-500">*</span></label>
                <select value={packageType} onChange={(e) => handleSelectPackage(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" required>
                  <option value="">{s.select_pkg_placeholder}</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.name}>{fmt(s.pkg_option, { name: p.name, items: p.totalItems, days: p.validDays, price: p.price.toLocaleString() })}</option>
                  ))}
                </select>
                {pkg && (
                  <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2 text-xs space-y-1">
                    {pkg.description && <p className="text-slate-500">{pkg.description}</p>}
                    <p className="text-purple-700 font-medium">{fmt(s.qty_n, { n: pkg.totalItems })}</p>
                    <p className="text-purple-700 font-medium">{fmt(s.expiry_full, { date: (() => { const d = new Date(Date.now() + pkg.validDays * 86400000); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; })(), n: pkg.validDays })}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{s.email} <span className="text-slate-400">{s.optional}</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="example@email.com" />
              </div>

              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>}

              <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50 mt-2" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)" }}>
                {loading ? s.registering : s.submit_register}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
