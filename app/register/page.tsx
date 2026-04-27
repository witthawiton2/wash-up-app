"use client";

import { useState, useEffect } from "react";
import liff from "@line/liff";

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

export default function RegisterPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [mode, setMode] = useState<"loading" | "register" | "renew">("loading");
  const [existingCustomer, setExistingCustomer] = useState<ExistingCustomer | null>(null);

  // Register fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
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
    if (!packageType) { setError("กรุณาเลือกแพ็คเกจ"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone, lineId, address, package: packageType, email, lineUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccessMessage("ลงทะเบียนสำเร็จ!");
      setSuccess(true);
      setTimeout(() => { try { if (liff.isInClient()) liff.closeWindow(); } catch { /* */ } }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!packageType) { setError("กรุณาเลือกแพ็คเกจ"); return; }
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
      setSuccessMessage("ส่งคำขอเติมแพ็คเกจแล้ว!");
      setSuccess(true);
      setTimeout(() => { try { if (liff.isInClient()) liff.closeWindow(); } catch { /* */ } }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const pkg = packages.find((p) => p.name === packageType);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">{successMessage}</h2>
            <p className="text-slate-500 text-sm">
              {mode === "renew" ? "รอแอดมินยืนยัน จะได้รับแจ้งเตือนทาง LINE" : "ขอบคุณที่สมัครสมาชิก Wash Up"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
        <p className="text-white text-sm">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-1">Wash Up</h1>
          <p className="text-blue-100 text-sm">{mode === "renew" ? "เติมแพ็คเกจ" : "ลงทะเบียนสมาชิก"}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {/* RENEW MODE */}
          {mode === "renew" && existingCustomer && (
            <form onSubmit={handleRenew} className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-700">{existingCustomer.name}</p>
                <p className="text-xs text-slate-400">{existingCustomer.phone}</p>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-slate-500">แพ็คเกจ: <span className="font-medium text-blue-600">{existingCustomer.package || "-"}</span></span>
                  <span className={`font-medium ${existingCustomer.remaining <= 0 ? "text-red-500" : "text-green-600"}`}>เหลือ {existingCustomer.remaining} ชิ้น</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">หมดอายุ: {existingCustomer.endDate}</p>
              </div>

              {existingCustomer.renewPending && (
                <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">⏳ มีคำขอเติมแพ็คเกจรออยู่แล้ว กรุณารอแอดมินยืนยัน</div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">เลือกแพ็คเกจที่ต้องการเติม</label>
                <select value={packageType} onChange={(e) => handleSelectPackage(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" required disabled={existingCustomer.renewPending}>
                  <option value="">-- เลือกแพ็คเกจ --</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.name}>{p.name} — {p.totalItems} ชิ้น / {p.validDays} วัน ({p.price.toLocaleString()}฿)</option>
                  ))}
                </select>
                {pkg && (
                  <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2 text-xs space-y-1">
                    {pkg.description && <p className="text-slate-500">{pkg.description}</p>}
                    <p className="text-purple-700 font-medium">จำนวน: +{pkg.totalItems} ชิ้น</p>
                    <p className="text-purple-700 font-bold text-base">ราคา: {pkg.price.toLocaleString()} ฿</p>
                  </div>
                )}
              </div>

              {qrData && pkg && (
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-slate-700">ชำระเงินผ่าน PromptPay</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrData.qr} alt="QR" className="mx-auto w-48 h-48 rounded-lg" />
                  <p className="text-sm font-bold">{qrData.account} กสิกร</p>
                  <p className="text-sm font-medium">{qrData.name}</p>
                  <p className="text-lg font-bold text-green-600">{pkg.price.toLocaleString()} ฿</p>
                </div>
              )}

              {packageType && !existingCustomer.renewPending && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">แนบสลิปการโอนเงิน</label>
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
                  {loading ? "กำลังส่ง..." : "ส่งคำขอเติมแพ็คเกจ"}
                </button>
              )}
            </form>
          )}

          {/* REGISTER MODE */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ <span className="text-red-500">*</span></label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="กรอกชื่อ" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">นามสกุล <span className="text-red-500">*</span></label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="กรอกนามสกุล" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="0812345678" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Line ID <span className="text-red-500">*</span></label>
                <input type="text" value={lineId} onChange={(e) => setLineId(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="กรอก Line ID" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่ <span className="text-red-500">*</span></label>
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="กรอกที่อยู่สำหรับจัดส่ง" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">แพ็คเกจ <span className="text-red-500">*</span></label>
                <select value={packageType} onChange={(e) => handleSelectPackage(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" required>
                  <option value="">-- เลือกแพ็คเกจ --</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.name}>{p.name} — {p.totalItems} ชิ้น / {p.validDays} วัน ({p.price.toLocaleString()}฿)</option>
                  ))}
                </select>
                {pkg && (
                  <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2 text-xs space-y-1">
                    {pkg.description && <p className="text-slate-500">{pkg.description}</p>}
                    <p className="text-purple-700 font-medium">จำนวน: {pkg.totalItems} ชิ้น</p>
                    <p className="text-purple-700 font-medium">หมดอายุ: {(() => { const d = new Date(Date.now() + pkg.validDays * 86400000); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; })()} ({pkg.validDays} วัน)</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-slate-400">(ไม่บังคับ)</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="example@email.com" />
              </div>

              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>}

              <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50 mt-2" style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)", boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)" }}>
                {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
