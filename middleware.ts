import { NextResponse, type NextRequest } from "next/server";

// Simple in-memory rate limiting for API routes
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRate(ip: string, limit: number = 120, windowMs: number = 60000): boolean {
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

export function middleware(request: NextRequest) {
  // Only rate-limit API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Skip rate limiting for receipt image generation
  if (request.nextUrl.pathname.startsWith("/api/receipt/")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const allowed = checkRate(ip, 120, 60000); // 120 requests per minute

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
