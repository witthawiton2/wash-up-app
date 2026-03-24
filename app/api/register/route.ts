import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      phone,
      lineId,
      address,
      package: pkg,
      email,
      lineUserId,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !phone || !lineId || !address || !pkg) {
      return NextResponse.json(
        { error: "กรุณากรอกข้อมูลให้ครบถ้วน" },
        { status: 400 }
      );
    }

    const name = `${firstName.trim()} ${lastName.trim()}`;

    // Save package name but don't add remaining yet — wait for admin approval
    const customerData = {
      name,
      phone: phone.trim(),
      lineId: lineId.trim(),
      address: address.trim(),
      package: pkg,
      remaining: 0,
      endDate: null as Date | null,
      status: "pending",
      email: email?.trim() || null,
    };

    // If lineUserId is available (from LIFF), upsert by it
    if (lineUserId) {
      const customer = await prisma.customer.upsert({
        where: { lineUserId },
        update: customerData,
        create: { ...customerData, lineUserId },
      });
      return NextResponse.json({ success: true, customer });
    }

    // Fallback: create without lineUserId (dev mode)
    const customer = await prisma.customer.create({
      data: customerData,
    });

    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
