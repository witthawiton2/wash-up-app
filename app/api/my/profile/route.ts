import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, getRequestLang } from "@/lib/api-i18n";
import { resolveLineUser } from "@/lib/line-auth";

// Customer-editable profile fields. Anything not in this set (customerCode,
// package, remaining, endDate, etc.) is shop-managed and intentionally
// omitted so customers can't tamper with their balance/package.
function pickEditable(body: Record<string, unknown>) {
  const out: { name?: string; phone?: string; address?: string; email?: string | null; lineId?: string | null } = {};
  if (typeof body.name === "string") out.name = body.name.trim();
  if (typeof body.phone === "string") out.phone = body.phone.trim();
  if (typeof body.address === "string") out.address = body.address.trim();
  if (typeof body.email === "string") out.email = body.email.trim() || null;
  if (typeof body.lineId === "string") out.lineId = body.lineId.trim() || null;
  return out;
}

export async function GET(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const claimed = request.nextUrl.searchParams.get("lineUserId");
    const auth = await resolveLineUser(request, claimed);
    if ("error" in auth) return apiError(lang, "generic_error", auth.status);
    const lineUserId = auth.userId;

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
      select: { name: true, phone: true, address: true, email: true, lineId: true },
    });
    if (!customer) return apiError(lang, "customer_not_found", 404);

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return apiError(lang, "generic_error", 500);
  }
}

export async function PUT(request: NextRequest) {
  const lang = getRequestLang(request);
  try {
    const body = await request.json();
    const { lineUserId: claimed, ...rest } = body;
    const auth = await resolveLineUser(request, claimed);
    if ("error" in auth) return apiError(lang, "generic_error", auth.status);
    const lineUserId = auth.userId;

    const data = pickEditable(rest);
    if (!data.name || !data.phone) return apiError(lang, "missing_fields", 400);

    const customer = await prisma.customer.findUnique({
      where: { lineUserId },
      select: { id: true },
    });
    if (!customer) return apiError(lang, "customer_not_found", 404);

    const updated = await prisma.customer.update({
      where: { lineUserId },
      data,
      select: { name: true, phone: true, address: true, email: true, lineId: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update profile:", error);
    return apiError(lang, "generic_error", 500);
  }
}
