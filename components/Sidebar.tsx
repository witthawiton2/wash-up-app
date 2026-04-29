"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, Role } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Users,
  Truck,
  Shirt,
  Flame,
  ClipboardList,
  Package,
  CalendarCheck,
  Wallet,
  UserCog,
  BarChart3,
  Settings as SettingsIcon,
  Moon,
  Globe,
  LogOut,
  type LucideIcon,
} from "lucide-react";

interface MenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/dashboard/customer", label: "Customer", icon: Users, roles: ["admin", "staff"] },
  { href: "/dashboard/delivery", label: "Delivery", icon: Truck, roles: ["admin", "driver"] },
  { href: "/dashboard/laundry", label: "Laundry", icon: Shirt, roles: ["admin", "staff"] },
  { href: "/dashboard/ironing", label: "Ironing", icon: Flame, roles: ["admin", "staff"] },
  { href: "/dashboard/services", label: "รายการสินค้า", icon: ClipboardList, roles: ["admin", "staff"] },
  { href: "/dashboard/packages", label: "แพ็คเกจ", icon: Package, roles: ["admin"] },
  { href: "/dashboard/bookings", label: "การจอง", icon: CalendarCheck, roles: ["admin", "staff"] },
  { href: "/dashboard/payments", label: "การชำระ", icon: Wallet, roles: ["admin", "staff"] },
  { href: "/dashboard/users", label: "User", icon: UserCog, roles: ["admin"] },
  { href: "/dashboard/summary", label: "Summary", icon: BarChart3, roles: ["admin"] },
  { href: "/dashboard/settings", label: "ตั้งค่า", icon: SettingsIcon, roles: ["admin"] },
];

const roleBadge: Record<Role, { label: string; bg: string }> = {
  admin: { label: "ผู้จัดการ", bg: "#8b5cf6" },
  staff: { label: "พนง.ทั่วไป", bg: "#3b82f6" },
  driver: { label: "พนง.รับส่ง", bg: "#10b981" },
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [badges, setBadges] = useState<Record<string, number>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("Wash Up");

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setLogoUrl(data.logoUrl || null);
        if (data.companyName) setCompanyName(data.companyName);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchSettings();
    const handler = () => fetchSettings();
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, [fetchSettings]);

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setBadges({
          "/dashboard/customer": data.pendingCustomers + data.renewPending,
          "/dashboard/bookings": data.todayBookings,
          "/dashboard/laundry": data.pendingOrders,
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchBadges]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const visibleItems = menuItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--sidebar-bg)" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-20 border-b border-white/5 px-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl || "/images/logo.png"}
            alt={companyName}
            className="h-12 object-contain"
          />
        </div>

        {/* User Info */}
        {user && (
          <div className="px-4 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
                style={{ background: `linear-gradient(135deg, ${roleBadge[user.role].bg}, ${roleBadge[user.role].bg}cc)` }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.name}
                </p>
                <span
                  className="inline-block text-[10px] text-white/80 px-2 py-0.5 rounded-full mt-0.5"
                  style={{ backgroundColor: `${roleBadge[user.role].bg}40`, border: `1px solid ${roleBadge[user.role].bg}60` }}
                >
                  {roleBadge[user.role].label}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 mt-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {visibleItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? "text-white shadow-lg"
                      : "hover:bg-slate-700/50"
                  }`}
                  style={
                    isActive(item.href)
                      ? {
                          backgroundColor: "var(--sidebar-active)",
                          boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
                        }
                      : { color: "var(--sidebar-text)" }
                  }
                >
                  <item.icon className="w-5 h-5" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {badges[item.href] > 0 && (
                    <span className="min-w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-red-500 px-1">
                      {badges[item.href]}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Settings + Logout */}
        <div className="p-3 border-t border-white/5 space-y-1.5">
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                const isDark = document.documentElement.classList.toggle("dark");
                localStorage.setItem("washup_dark", isDark ? "1" : "0");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              <Moon className="w-3.5 h-3.5" />
              Dark
            </button>
            <button
              onClick={() => {
                const cur = localStorage.getItem("washup_lang") || "th";
                const next = cur === "th" ? "en" : "th";
                localStorage.setItem("washup_lang", next);
                window.location.reload();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {typeof window !== "undefined" && localStorage.getItem("washup_lang") === "en" ? "TH" : "EN"}
            </button>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            <LogOut className="w-4 h-4" />
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  );
}
