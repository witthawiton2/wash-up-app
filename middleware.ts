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

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
