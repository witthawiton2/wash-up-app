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

// Returns the session if the request has a valid staff cookie, or a 401
// response to short-circuit the route. Optionally restrict to specific roles.
export async function requireStaff(
  request: NextRequest,
  allowedRoles?: string[],
): Promise<{ session: Session } | { response: NextResponse }> {
  const session = await getSession(request);
  if (!session) return { response: unauthorized() };
  if (allowedRoles && !allowedRoles.includes(session.r)) {
    return { response: forbidden() };
  }
  return { session };
}
