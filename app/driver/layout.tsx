"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSettings } from "@/lib/settings-context";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "driver" && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={settings.logoUrl || "/images/logo.png"} alt="logo" className="h-8 object-contain" />
          <div className="text-sm">
            <div className="font-bold text-slate-800">{user.name}</div>
            <div className="text-xs text-emerald-600">พนักงานรับส่ง</div>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-xs text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-red-200"
        >
          ออก
        </button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
