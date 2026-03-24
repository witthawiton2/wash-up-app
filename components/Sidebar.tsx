"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, Role } from "@/lib/auth-context";

interface MenuItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
}

const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "\u{1F3E0}", roles: ["admin", "staff", "driver"] },
  { href: "/dashboard/customer", label: "Customer", icon: "\u{1F464}", roles: ["admin", "staff"] },
  { href: "/dashboard/delivery", label: "Delivery", icon: "\u{1F69A}", roles: ["admin", "driver"] },
  { href: "/dashboard/laundry", label: "Laundry", icon: "\u{1F455}", roles: ["admin", "staff"] },
  { href: "/dashboard/services", label: "รายการสินค้า", icon: "\u{1F4CB}", roles: ["admin", "staff"] },
  { href: "/dashboard/packages", label: "แพ็คเกจ", icon: "\u{1F4E6}", roles: ["admin"] },
  { href: "/dashboard/users", label: "User", icon: "\u{1F465}", roles: ["admin"] },
  { href: "/dashboard/summary", label: "Summary", icon: "\u{1F4CA}", roles: ["admin"] },
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
        <div className="flex items-center justify-center h-20 border-b border-slate-700">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-wider">
              WASH UP
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Laundry Management</p>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="px-4 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: roleBadge[user.role].bg }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user.name}
                </p>
                <span
                  className="inline-block text-xs text-white px-2 py-0.5 rounded-full mt-0.5"
                  style={{ backgroundColor: roleBadge[user.role].bg }}
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
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
            style={{ backgroundColor: "#ef4444" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  );
}
