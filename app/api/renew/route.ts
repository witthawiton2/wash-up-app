import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdminRenewRequest } from "@/lib/notify-admin";
import { formatDate } from "@/lib/timezone";
import { apiError, getRequestLang } from "@/lib/api-i18n";
import { resolveLineUser } from "@/lib/line-auth";

// GET: ดึงข้อมูลลูกค้าจาก lineUserId
export async function GET(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const claimed = request.nextUrl.searchParams.get("lineUserId");
    const auth = await resolveLineUser(request, claimed);
    if ("error" in auth) return apiError(lang, "generic_error", auth.status);
    const lineUserId = auth.userId;

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
    });

    if (!customer) {
      return apiError(lang, "customer_not_found", 404);
    }

    return NextResponse.json({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      package: customer.package,
      remaining: customer.remaining,
      endDate: customer.endDate ? formatDate(customer.endDate) : "-",
      renewPending: customer.renewPending,
    });
  } catch (error) {
    console.error("Renew GET error:", error);
    return apiError(lang, "generic_error", 500);
  }
}

// POST: ส่งคำขอเติมแพ็คเกจ
export async function POST(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const body = await request.json();
    const { lineUserId: claimed, packageName, slipUrl } = body;
    const auth = await resolveLineUser(request, claimed);
    if ("error" in auth) return apiError(lang, "generic_error", auth.status);
    const lineUserId = auth.userId;

    if (!packageName) {
      return apiError(lang, "missing_fields", 400);
    }

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
    });

    if (!customer) {
      return apiError(lang, "customer_not_found", 404);
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
    return apiError(lang, "generic_error", 500);
  }
}
