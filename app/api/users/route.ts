import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["admin", "staff", "driver", "ironer"];

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

// Guard against removing the last usable admin (demote / deactivate / delete),
// which would lock everyone out of admin features.
async function wouldOrphanAdmins(userId: number): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, active: true },
  });
  if (!target || target.role !== "admin" || !target.active) return false;
  const activeAdmins = await prisma.user.count({ where: { role: "admin", active: true } });
  return activeAdmins <= 1;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // The user management dashboard needs to see inactive users too (toggle
    // them on/off), so default is "include all". Pass ?activeOnly=1 to
    // restrict to active accounts (used by staff-picker dropdowns).
    const activeOnly = searchParams.get("activeOnly") === "1";
    const limitParam = searchParams.get("limit");

    const where = activeOnly ? { active: true } : {};
    const take = limitParam
      ? Math.min(parseInt(limitParam, 10) || 200, 1000)
      : 200;

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name, role } = body;

    if (!username || !password || !name || !role) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "สิทธิ์ (role) ไม่ถูกต้อง" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: await bcrypt.hash(password.trim(), 10),
        name: name.trim(),
        role,
      },
      select: { id: true, username: true, name: true, role: true, active: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 409 });
    }
    console.error("Failed to create user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, username, password, name, role, active } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "สิทธิ์ (role) ไม่ถูกต้อง" }, { status: 400 });
    }

    // Block demoting or deactivating the final admin.
    const demoting = role && role !== "admin";
    const deactivating = active === false;
    if ((demoting || deactivating) && (await wouldOrphanAdmins(Number(id)))) {
      return NextResponse.json(
        { error: "ต้องมีผู้จัดการ (admin) ที่ใช้งานได้อย่างน้อย 1 คน" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (username) updateData.username = username.trim();
    if (password) updateData.password = await bcrypt.hash(password.trim(), 10);
    if (name) updateData.name = name.trim();
    if (role) updateData.role = role;
    if (active !== undefined) updateData.active = active;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, name: true, role: true, active: true },
    });

    return NextResponse.json(user);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 409 });
    }
    console.error("Failed to update user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    const numId = Number(id);
    const existing = await prisma.user.findUnique({ where: { id: numId } });
    if (!existing) {
      return NextResponse.json({ success: true, alreadyGone: true });
    }
    if (await wouldOrphanAdmins(numId)) {
      return NextResponse.json(
        { error: "ลบไม่ได้ — ต้องมีผู้จัดการ (admin) ที่ใช้งานได้อย่างน้อย 1 คน" },
        { status: 400 }
      );
    }
    await prisma.user.delete({ where: { id: numId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete user:", msg);
    return NextResponse.json(
      { error: "Failed to delete user", detail: msg },
      { status: 500 }
    );
  }
}
