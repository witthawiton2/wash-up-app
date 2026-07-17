"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Client-side guard for admin-only dashboard pages. The backing APIs are
// gated server-side in middleware.ts, so this is purely UX: bounce a
// non-admin who types the URL to the dashboard instead of rendering an admin
// page whose every request would 403.
export function useRequireAdmin() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);
}
