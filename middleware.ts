import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// In-memory rate limit (per server instance).
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRate(ip: string, limit = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Paths and methods that don't require a staff session.
// Anything not listed here must have a valid session cookie.
const PUBLIC_EXACT = new Set<string>([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/register",
  "/api/promptpay-qr",
  "/api/renew",
  "/api/upload",
]);

const PUBLIC_PREFIXES = ["/api/my/", "/api/receipt/"];

// GET-only public — POST/PUT/DELETE require staff.
const PUBLIC_GET = new Set<string>([
  "/api/packages",
  "/api/settings",
]);

function isPublic(path: string, method: string): boolean {
  if (PUBLIC_EXACT.has(path)) return true;
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (method === "GET" && PUBLIC_GET.has(path)) return true;
  return false;
}

type Role = "admin" | "staff" | "driver" | "ironer";

// Server-side role gate. Returns the roles allowed to reach `path` with
// `method`, or null for "any authenticated role". Public paths never reach
// here. This mirrors the sidebar's intended access so it can't be bypassed by
// typing a URL or calling the API directly. Public GETs (packages, settings)
// are already allowed above, so a request reaching these prefixes is a mutation.
function allowedRoles(path: string, method: string): Role[] | null {
  if (path.startsWith("/api/summary")) return ["admin"];
  if (path.startsWith("/api/export")) return ["admin"];
  if (path.startsWith("/api/booking-slots")) return ["admin"];
  if (path.startsWith("/api/settings")) return ["admin"];
  if (path.startsWith("/api/packages")) return ["admin"];
  if (path.startsWith("/api/upload/logo")) return ["admin"];
  if (path.startsWith("/api/reports/")) return ["admin", "staff"];
  // User list is read by the ironing staff-picker; only mutations are admin-only.
  if (path.startsWith("/api/users")) return method === "GET" ? null : ["admin"];
  return null;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!path.startsWith("/api/")) return NextResponse.next();

  // Rate limit (skip receipt image generation — LINE polls it).
  if (!path.startsWith("/api/receipt/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (!checkRate(ip, 120, 60_000)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
  }

  if (isPublic(path, request.method)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = allowedRoles(path, request.method);
  if (allowed && !allowed.includes(session.r as Role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
