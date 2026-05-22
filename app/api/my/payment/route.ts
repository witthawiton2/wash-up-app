import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdminLine } from "@/lib/notify-admin";

function isValidSlipUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    // Match against the configured Supabase project — covers
    // <project>.supabase.co and any custom storage hostname set via env.
    const supabaseHost = process.env.SUPABASE_URL
      ? new URL(process.env.SUPABASE_URL).hostname
      : null;
    if (supabaseHost && u.hostname === supabaseHost) return true;
    if (u.hostname.endsWith(".supabase.co")) return true;
    return false;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, orderId, slipUrl } = body;

    if (!lineUserId || !orderId || !slipUrl) {
      return NextResponse.json(
        { error: "lineUserId, orderId, and slipUrl are required" },
        { status: 400 }
      );
    }

    // Only accept slip URLs we ourselves issued (Supabase storage bucket
    // configured in SUPABASE_URL). Stops clients from pointing the field
    // at arbitrary external images.
    if (!isValidSlipUrl(slipUrl)) {
      return NextResponse.json(
        { error: "Invalid slip URL" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({ where: { lineUserId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const order = await prisma.order.findUnique({ where: { orderId } });
    if (!order || order.customerId !== customer.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await prisma.order.update({
      where: { orderId },
      data: {
        paymentSlipUrl: slipUrl,
        paymentStatus: "pending",
      },
    });

    notifyAdminLine(`💰 มีสลิปการชำระใหม่!\n\nลูกค้า: ${customer.name}\nออเดอร์: ${orderId}\nยอด: ${order.totalAmount.toLocaleString()}฿\n\nกรุณาตรวจสอบที่หน้า Payments`).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to upload payment slip:", error);
    return NextResponse.json({ error: "Failed to upload payment slip" }, { status: 500 });
  }
}
