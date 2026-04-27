import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdminRenewRequest } from "@/lib/notify-admin";

// GET: ดึงข้อมูลลูกค้าจาก lineUserId
export async function GET(request: NextRequest) {
  try {
    const lineUserId = request.nextUrl.searchParams.get("lineUserId");
    if (!lineUserId) {
      return NextResponse.json({ error: "lineUserId is required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
    });

    if (!customer) {
      return NextResponse.json({ error: "ไม่พบข้อมูลลูกค้า กรุณาลงทะเบียนก่อน" }, { status: 404 });
    }

    return NextResponse.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      package: customer.package,
      remaining: customer.remaining,
      endDate: customer.endDate
        ? customer.endDate.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "-",
      renewPending: customer.renewPending,
    });
  } catch (error) {
    console.error("Renew GET error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}

// POST: ส่งคำขอเติมแพ็คเกจ
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, packageName, slipUrl } = body;

    if (!lineUserId || !packageName) {
      return NextResponse.json({ error: "lineUserId and packageName are required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
    });

    if (!customer) {
      return NextResponse.json({ error: "ไม่พบข้อมูลลูกค้า" }, { status: 404 });
    }

    await prisma.customer.update({
      where: { lineUserId },
      data: {
        package: packageName,
        renewPending: true,
        renewSlipUrl: slipUrl || null,
      },
    });

    // Notify admin
    const pkg = await prisma.package.findFirst({ where: { name: packageName } });
    notifyAdminRenewRequest(customer.name, packageName, pkg?.price || 0).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Renew POST error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 });
  }
}
