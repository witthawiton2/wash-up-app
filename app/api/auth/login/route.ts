import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECS, signSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    // Support both bcrypt hashed and plain text passwords (migration period)
    const isHashed = user?.password?.startsWith("$2");
    const passwordMatch = user && (isHashed ? await bcrypt.compare(password, user.password) : user.password === password);
    if (!user || !passwordMatch) {
      return NextResponse.json(
        { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { error: "บัญชีนี้ถูกปิดใช้งาน" },
        { status: 403 }
      );
    }

    const token = await signSession({
      u: user.username,
      n: user.name,
      r: user.role,
      exp: Date.now() + SESSION_MAX_AGE_SECS * 1000,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECS,
    });
    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด กรุณาลองใหม่" },
      { status: 500 }
    );
  }
}
