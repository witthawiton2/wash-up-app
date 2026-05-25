import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdminNewRegistration } from "@/lib/notify-admin";
import { apiError, getRequestLang } from "@/lib/api-i18n";

export async function POST(request: NextRequest) {
  const lang = getRequestLang(request);
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

    // Validate required fields — lineId (LINE display handle) is optional;
    // lineUserId comes from LIFF and is the real identity link.
    if (!firstName || !lastName || !phone || !address || !pkg) {
      return apiError(lang, "missing_fields", 400);
    }

    const name = `${firstName.trim()} ${lastName.trim()}`;

    // Save package name but don't add remaining yet — wait for admin approval
    const customerData = {
      name,
      phone: phone.trim(),
      lineId: lineId?.trim() || null,
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
      notifyAdminNewRegistration(name).catch(() => {});
      return NextResponse.json({ success: true, customer });
    }

    // Fallback: create without lineUserId (dev mode)
    const customer = await prisma.customer.create({
      data: customerData,
    });

    notifyAdminNewRegistration(name).catch(() => {});
    return NextResponse.json({ success: true, customer });
  } catch (error) {
    console.error("Registration error:", error);
    return apiError(lang, "generic_error", 500);
  }
}
