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

export default function RegisterPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [address, setAddress] = useState("");
  const [packageType, setPackageType] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [packages, setPackages] = useState<PackageOption[]>([]);

  useEffect(() => {
    // Fetch packages from DB
    fetch("/api/packages")
      .then((res) => res.json())
      .then((data) => setPackages(data))
      .catch(() => {});

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return;

    liff
      .init({ liffId })
      .then(() => {
        if (liff.isLoggedIn()) {
          liff.getProfile().then((profile) => {
            setLineUserId(profile.userId);
          });
        } else {
          liff.login();
        }
      })
      .catch((err) => {
        console.error("LIFF init failed:", err);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!packageType) {
      setError("กรุณาเลือกแพ็คเกจ");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          lineId,
          address,
          package: packageType,
          email,
          lineUserId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(true);
      setTimeout(() => {
        try {
          if (liff.isInClient()) liff.closeWindow();
        } catch {
          // not in LIFF context
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          background: "linear-gradient(135deg, #7c3aed, #2563eb)",
        }}
      >
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-5xl mb-4">&#10003;</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              ลงทะเบียนสำเร็จ!
            </h2>
            <p className="text-slate-500 text-sm">
              ขอบคุณที่สมัครสมาชิก Wash Up
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: "linear-gradient(135deg, #7c3aed, #2563eb)",
      }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1
            className="text-4xl font-bold mb-1"
            style={{ color: "#7c3aed" }}
          >
            <span className="text-white">Wash Up</span>
          </h1>
          <p className="text-blue-100 text-sm">ลงทะเบียนสมาชิก</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ชื่อ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ชื่อ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="กรอกชื่อ"
                required
              />
            </div>

            {/* นามสกุล */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="กรอกนามสกุล"
                required
              />
            </div>

            {/* เบอร์โทรศัพท์ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="0812345678"
                required
              />
            </div>

            {/* Line ID */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Line ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="กรอก Line ID"
                required
              />
            </div>

            {/* ที่อยู่ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ที่อยู่ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="กรอกที่อยู่สำหรับจัดส่ง"
                required
              />
            </div>

            {/* แพ็คเกจ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                แพ็คเกจ <span className="text-red-500">*</span>
              </label>
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                required
              >
                <option value="">-- เลือกแพ็คเกจ --</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} — {p.totalItems} ชิ้น / {p.validDays} วัน ({p.price.toLocaleString()}฿)
                  </option>
                ))}
              </select>
              {packageType && (() => {
                const pkg = packages.find((p) => p.name === packageType);
                if (!pkg) return null;
                const expDate = new Date(Date.now() + pkg.validDays * 24 * 60 * 60 * 1000);
                const expStr = `${String(expDate.getDate()).padStart(2, "0")}/${String(expDate.getMonth() + 1).padStart(2, "0")}/${expDate.getFullYear()}`;
                return (
                  <div className="mt-2 bg-purple-50 rounded-lg px-3 py-2 text-xs space-y-1">
                    {pkg.description && <p className="text-slate-500">{pkg.description}</p>}
                    <p className="text-purple-700 font-medium">จำนวน: {pkg.totalItems} ชิ้น</p>
                    <p className="text-purple-700 font-medium">หมดอายุ: {expStr} ({pkg.validDays} วัน)</p>
                  </div>
                );
              })()}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email <span className="text-slate-400">(ไม่บังคับ)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                placeholder="example@email.com"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50 mt-2"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #2563eb)",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.4)",
              }}
            >
              {loading ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
