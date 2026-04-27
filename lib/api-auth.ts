import { NextRequest, NextResponse } from "next/server";

export function getSessionFromHeaders(request: NextRequest): { username: string; role: string } | null {
  const session = request.headers.get("x-user-session");
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
