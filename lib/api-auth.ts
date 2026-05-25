import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

export type Session = SessionPayload;

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function getSession(request: NextRequest): Promise<Session | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}
