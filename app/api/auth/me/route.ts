import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { username: session.u, name: session.n, role: session.r },
  });
}
