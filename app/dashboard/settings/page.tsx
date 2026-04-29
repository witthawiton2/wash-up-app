"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface Settings {
  logoUrl: string | null;
  companyName: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  lineId: string | null;
  promptpayId: string | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
}

const empty: Settings = {
  logoUrl: null,
  companyName: "",
  companyPhone: "",
  companyAddress: "",
  lineId: "",
  promptpayId: "",
  receiptHeader: "",
  receiptFooter: "",
};

export default function SettingsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [isLoading, user, router]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setForm({
          logoUrl: data.logoUrl ?? null,
          companyName: data.companyName ?? "",
          companyPhone: data.companyPhone ?? "",
          companyAddress: data.companyAddress ?? "",
          lineId: data.lineId ?? "",
          promptpayId: data.promptpayId ?? "",
          receiptHeader: data.receiptHeader ?? "",
          receiptFooter: data.receiptFooter ?? "",
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setForm((f) => ({ ...f, logoUrl: data.url }));
        setMessage({ type: "ok", text: "อัปโหลดโลโก้สำเร็จ — กดบันทึกเพื่อยืนยัน" });
      } else {
        setMessage({ type: "err", text: data.error || "อัปโหลดไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "err", text: "อัปโหลดไม่สำเร็จ" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "ok", text: "บันทึกการตั้งค่าสำเร็จ" });
        window.dispatchEvent(new Event("settings-updated"));
      } else {
        setMessage({ type: "err", text: "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "err", text: "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return <p className="text-slate-400">กำลังโหลด...</p>;
  }

  if (user?.role !== "admin") return null;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">ตั้งค่าร้าน</h2>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="card mb-4">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">โลโก้ร้าน</h3>
        <div className="flex items-center gap-6">
          <div className="w-32 h-32 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
            {form.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logoUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400">ไม่มีโลโก้</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-primary disabled:opacity-50"
            >
              {uploading ? "กำลังอัปโหลด..." : form.logoUrl ? "เปลี่ยนโลโก้" : "เลือกรูป"}
            </button>
            {form.logoUrl && (
              <button
                onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}
                className="ml-2 text-sm text-red-500 hover:text-red-700"
              >
                ลบโลโก้
              </button>
            )}
            <p className="text-xs text-slate-500 mt-2">
              รองรับ JPG/PNG ขนาดไม่เกิน 5MB
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">ข้อมูลร้าน</h3>
        <div className="space-y-4">
          <Field
            label="ชื่อร้าน"
            value={form.companyName ?? ""}
            onChange={(v) => setForm({ ...form, companyName: v })}
            placeholder="เช่น Wash Up Laundry"
          />
          <Field
            label="เบอร์โทร"
            value={form.companyPhone ?? ""}
            onChange={(v) => setForm({ ...form, companyPhone: v })}
            placeholder="08X-XXX-XXXX"
          />
          <Field
            label="ที่อยู่"
            value={form.companyAddress ?? ""}
            onChange={(v) => setForm({ ...form, companyAddress: v })}
            placeholder="ที่อยู่ร้าน"
            multiline
          />
          <Field
            label="LINE ID"
            value={form.lineId ?? ""}
            onChange={(v) => setForm({ ...form, lineId: v })}
            placeholder="@washup"
          />
          <Field
            label="PromptPay ID"
            value={form.promptpayId ?? ""}
            onChange={(v) => setForm({ ...form, promptpayId: v })}
            placeholder="เลขโทรศัพท์/เลขบัตรประชาชนสำหรับ PromptPay"
          />
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">ข้อความใบเสร็จ</h3>
        <div className="space-y-4">
          <Field
            label="ข้อความหัวใบเสร็จ"
            value={form.receiptHeader ?? ""}
            onChange={(v) => setForm({ ...form, receiptHeader: v })}
            placeholder="ขอบคุณที่ใช้บริการ"
            multiline
          />
          <Field
            label="ข้อความท้ายใบเสร็จ"
            value={form.receiptFooter ?? ""}
            onChange={(v) => setForm({ ...form, receiptFooter: v })}
            placeholder="แล้วเจอกันใหม่ครับ"
            multiline
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary px-6 py-2.5 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {multiline ? (
        <textarea
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
